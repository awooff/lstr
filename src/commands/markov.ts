import {
	type ChatInputCommandInteraction,
	type Message,
	SlashCommandBuilder,
} from "discord.js";
import { logger } from "~/logger";

// Markov chain state
const markovChain = new Map();
let starters: string[] = [];
let isTrained = false;

// Create Markov chain from text
const addTextToChain = (text: string, order = 2) => {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

	for (const sentence of sentences) {
		const words = sentence
			.trim()
			.split(/\s+/)
			.filter((w) => w.length > 0);
		if (words.length <= order) continue;

		// Add sentence starter
		const starter = words.slice(0, order).join(" ");
		if (!starters.includes(starter)) {
			starters.push(starter);
		}

		// Build the chain
		for (let i = 0; i <= words.length - order; i++) {
			const key = words.slice(i, i + order).join(" ");
			const nextWord = words[i + order];

			if (!markovChain.has(key)) {
				markovChain.set(key, []);
			}

			if (nextWord) {
				markovChain.get(key).push(nextWord);
			}
		}
	}
};

// Generate text using the Markov chain
const generateText = (maxLength = 100) => {
	if (starters.length === 0) {
		return "No training data available! Use `/markov retrain` first.";
	}

	const starter = starters[Math.floor(Math.random() * starters.length)];
	const result = starter?.split(" ");

	for (let i = 0; i < maxLength; i++) {
		const key = result?.slice(-2).join(" ");
		const possibilities = markovChain.get(key);

		if (!possibilities || possibilities.length === 0) {
			const allWords = Array.from(markovChain.values()).flat();
			const randomFiller =
				allWords[Math.floor(Math.random() * allWords.length)];
			if (!randomFiller) break;
			result?.push(randomFiller);
			continue;
		}

		const nextWord =
			possibilities[
			Math.floor(Math.random() * possibilities.length * Math.random())
			];
		result?.push(nextWord);

		if (nextWord.match(/[.!?]$/)) break;
	}

	return result?.join(" ");
};

// Load training data from message history
const loadTrainingData = async (channel: any) => {
	try {
		const messages = await channel.messages.fetch({ limit: 100 });
		const content = messages
			.filter((msg: Message): string | false => !msg.author.bot && msg.content)
			.map((msg: Message) => msg.content)
			.join("\n");

		if (!content) {
			return {
				success: false,
				error: "No usable messages found in the last 100 messages.",
			};
		}

		// Reset chain
		markovChain.clear();
		starters = [];

		addTextToChain(content);
		isTrained = true;

		return {
			success: true,
			filesLoaded: 1,
			chainSize: markovChain.size,
			starterCount: starters.length,
		};
	} catch (err: any) {
		logger.error("Error fetching messages:", err);
		return {
			success: false,
			error: err.message || "Unknown error",
		};
	}
};

// Generate chaos mode output
const generateChaoticMessage = async (channel: any, length = 60) => {
	const messages = await channel.messages.fetch({ limit: 100 });
	const pool = messages
		.filter((msg: Message) => !msg.author.bot && msg.content)
		.map((msg: Message) => msg.content.trim())
		.map((text: string) => text.split(/\s+/).filter((w) => w.length > 0))
		.filter((words: string) => words.length > 0);

	if (pool.length === 0) return "No valid messages to generate chaos.";

	const output: string[] = [];

	while (output.length < length) {
		const msgWords = pool[Math.floor(Math.random() * pool.length)];
		const startIdx = Math.floor(Math.random() * msgWords?.length);
		const chunkLen = Math.floor(Math.random() * 4) + 1;
		const chunk =
			msgWords?.slice(startIdx, startIdx + chunkLen) ??
			"No message words can be sliced";
		output.push(...chunk);
	}

	// Clean sentence
	let result = output.join(" ");
	result = result[0]?.toUpperCase() + result.slice(1);
	if (!/[.!?]$/.test(result)) result += ".";

	return result;
};

export default {
	data: new SlashCommandBuilder()
		.setName("markov")
		.setDescription("Generate weird sentences from your chat history")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("generate")
				.setDescription("Generate semi-realistic text from Markov chain")
				.addIntegerOption((option) =>
					option
						.setName("length")
						.setDescription("Max number of words to generate")
						.setMinValue(10)
						.setMaxValue(200)
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("retrain")
				.setDescription("Retrain the Markov chain from the last 100 messages"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("stats").setDescription("Show Markov chain stats"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("chaos")
				.setDescription("Create a chaotic sentence from random words in chat"),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === "generate") {
			const length = interaction.options.getInteger("length") ?? 50;

			if (!isTrained) {
				await interaction.reply({
					content: "Not trained yet. Use `/markov retrain` first.",
					ephemeral: true,
				});
				return;
			}

			const generatedText = generateText(length);
			await interaction.reply(generatedText!.slice(0, 2000));
		} else if (subcommand === "retrain") {
			await interaction.deferReply();
			try {
				const channel = await interaction.client.channels.fetch(
					interaction.channelId,
				);
				if (!channel?.isTextBased()) {
					await interaction.editReply("Only works in text channels.");
					return;
				}

				const result = await loadTrainingData(channel);
				if (result.success) {
					await interaction.editReply(
						`Retrained from 100 messages.\nChain size: ${result.chainSize}\nStarters: ${result.starterCount}`,
					);
				} else {
					await interaction.editReply(`❌ Failed: ${result.error}`);
				}
			} catch (err: any) {
				logger.error("Retrain failed:", err);
				await interaction.editReply(
					"Something went wrong fetching the channel.",
				);
			}
		} else if (subcommand === "stats") {
			if (!isTrained) {
				await interaction.reply({
					content: "Not trained yet. Use `/markov retrain` first.",
					ephemeral: true,
				});
				return;
			}

			await interaction.reply({
				content:
					`**Markov Chain Stats**\n` +
					`Chain size :: ${markovChain.size}\n` +
					`Starters :: ${starters.length}\n` +
					`Order :: 1 (chaotic big dumb mode)`,
				ephemeral: true,
			});
		} else if (subcommand === "chaos") {
			await interaction.deferReply();
			try {
				const channel = await interaction.client.channels.fetch(
					interaction.channelId,
				);
				if (!channel?.isTextBased()) {
					await interaction.editReply("Only works in text channels.");
					return;
				}

				const sentence = await generateChaoticMessage(channel, 60);
				await interaction.editReply(sentence.slice(0, 2000));
				// biome-ignore lint/suspicious/noExplicitAny: why is this even a ts error anyway? it'll complain if it's not
			} catch (err: any) {
				logger.error("Chaos generation failed:", err);
				await interaction.editReply(
					"Something went wrong while generating chaos.",
				);
			}
		}
	},
};
