import { SlashCommandBuilder } from "discord.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { logger } from "~/logger";

// Markov chain state
const markovChain = new Map();
let starters: any[] = [];
let isTrained = false;

// Create Markov chain from text
const addTextToChain = (text: string, order = 2) => {
	const sentences = text
		.split(/[.!?]+/)
		.filter((s: string) => s.trim().length > 0);

	for (const sentence of sentences) {
		const words = sentence
			.trim()
			.split(/\s+/)
			.filter((w: string) => w.length > 0);
		if (words.length <= order) continue;

		// Add sentence starter
		const starter = words.slice(0, order).join(" ");
		starters.push(starter);

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
	const result = starter.split(" ");

	for (let i = 0; i < maxLength; i++) {
		const key = result.slice(-2).join(" ");
		const possibilities = markovChain.get(key);

		if (!possibilities || possibilities.length === 0) {
			break;
		}

		const nextWord =
			possibilities[Math.floor(Math.random() * possibilities.length)];
		result.push(nextWord);

		if (nextWord.match(/[.!?]$/)) {
			break;
		}
	}

	return result.join(" ");
};

/**
 * here is where we will make some nice changes :)
 *
 */

// Load training data from files
const loadTrainingData = () => {
	throw new Error("Not yet implemented!");
};

// Initialize training data on module load
loadTrainingData();

// Export the slash command
export default {
	data: new SlashCommandBuilder()
		.setName("markov")
		.setDescription(
			"Generate text using Markov chains from your message history",
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("generate")
				.setDescription("Generate text using the Markov chain")
				.addIntegerOption((option) =>
					option
						.setName("length")
						.setDescription("Maximum number of words to generate")
						.setMinValue(10)
						.setMaxValue(200)
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("retrain")
				.setDescription("Reload training data and retrain the Markov chain"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("stats")
				.setDescription("Show statistics about the current Markov chain"),
		),

	async execute(interaction: any) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === "generate") {
			const length = interaction.options.getInteger("length") ?? 50;

			if (!isTrained) {
				await interaction.reply({
					content:
						"Markov chain not trained yet. Use `/markov retrain` to load training data.",
					ephemeral: true,
				});
				return;
			}

			const generatedText = generateText(length);

			if (generatedText.length > 2000) {
				await interaction.reply({
					content:
						"Generated text is too long for Discord! Try a shorter length.",
					ephemeral: true,
				});
				return;
			}

			await interaction.reply(generatedText);
		} else if (subcommand === "retrain") {
			await interaction.deferReply();

			const result = loadTrainingData();

			if (result.success) {
				await interaction.editReply(
					`Retrained successfully!\n` +
						`Files loaded: ${result.filesLoaded}\n` +
						`Chain size: ${result.chainSize}\n` +
						`Sentence starters: ${result.starterCount}`,
				);
			} else {
				await interaction.editReply(`Failed to retrain: ${result.error}`);
			}
		} else if (subcommand === "stats") {
			if (!isTrained) {
				await interaction.reply({
					content:
						"Markov chain not trained yet. Use `/markov retrain` to load training data.",
					ephemeral: true,
				});
				return;
			}

			await interaction.reply({
				content:
					`**Markov Chain Statistics**\n` +
					`Chain size: ${markovChain.size}\n` +
					`Sentence starters: ${starters.length}\n` +
					`Order: 2 (bigram)\n`,
				ephemeral: true,
			});
		}
	},
};
