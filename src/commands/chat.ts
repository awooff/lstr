import { InferenceClient } from "@huggingface/inference";
import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { logger } from "~/logger";

const client = new InferenceClient(Bun.env.HF_TOKEN);

const splitIntoChunks = (text: string, maxLength = 1024): string[] => {
	const chunks: string[] = [];
	let current = "";

	for (const line of text.split("\n")) {
		if ((`${current + line}\n`).length > maxLength) {
			chunks.push(current);
			current = "";
		}
		current += `${line}\n`;
	}

	if (current.trim()) {
		chunks.push(current);
	}

	return chunks;
}

export const data = new SlashCommandBuilder()
	.setName("chat")
	.setDescription("Send a message to the Llama 3.1 model")
	.addStringOption((option) =>
		option
			.setName("message")
			.setDescription("What you want to say to the model")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction) {
	const userMessage = interaction.options.getString("message", true);
	await interaction.deferReply();

	try {
		let visibleText = "";
		let afterThink = false;
		let rawBuffer = "";
		let lastEditTime = Date.now();

		const stream = client.chatCompletionStream({
            model: "deepseek-ai/DeepSeek-R1-0528",
            provider: "sambanova",
            messages: [{ role: "user", content: userMessage }],
            temperature: 1.0,
            stream: true,
        });

		// Initial embed while we wait
		const embed = new EmbedBuilder()
			.setTitle(`User has asked: ${userMessage}`)
			.setDescription("`Thinking...`")
			.setColor(0x5865f2);

		await interaction.editReply({ embeds: [embed] });

		for await (const chunk of stream) {
			const content = chunk?.choices?.[0]?.delta?.content;
			if (!content) continue;

			rawBuffer += content;

			// Once </think> is seen, begin rendering
			if (!afterThink) {
				const endTagIndex = rawBuffer.lastIndexOf("</think>");
				if (endTagIndex !== -1) {
					afterThink = true;
					visibleText = rawBuffer.slice(endTagIndex + "</think>".length);
				}
			} else {
				visibleText += content;
			}

			const now = Date.now();
			if (now - lastEditTime > 500) {
				const partialEmbed = new EmbedBuilder()
					.setTitle(`You asked: ${userMessage}`)
					.setDescription(`${visibleText.slice(0, 4096 - 5)} ▌`)
					.setColor(0x5865f2)
					.setFooter({ text: `You: ${userMessage}` });

				await interaction.editReply({ embeds: [partialEmbed] });
				lastEditTime = now;
			}
		}

		const finalOutput = visibleText.trim();
		if (!finalOutput) {
			const failEmbed = new EmbedBuilder()
				.setTitle(`You asked: ${userMessage}`)
				.setDescription("_[No meaningful response]_")
				.setColor(0xff5555)
				.setFooter({ text: `You: ${userMessage}` });

			await interaction.editReply({ embeds: [failEmbed] });
			return;
		}

		// Split across multiple embeds if needed
		const chunks = splitIntoChunks(finalOutput, 1024);
		const firstEmbed = new EmbedBuilder()
			.setTitle(`You: ${userMessage}`)
			.setColor(0x5865f2)
			// biome-ignore lint/suspicious/noExplicitAny: why does it matter, it just works :tm:
			.setDescription(chunks[0] as any);

		await interaction.editReply({ embeds: [firstEmbed] });

		for (let i = 1; i < chunks.length; i++) {
			const embed = new EmbedBuilder()
				.setColor(0x5865f2)
				// biome-ignore lint/suspicious/noExplicitAny: why does it matter, it just works :tm:
				.setDescription(chunks[i] as any);
			await interaction.followUp({ embeds: [embed] });
		}
	} catch (err) {
		logger.error("Streaming inference error:", err);
		const errorEmbed = new EmbedBuilder()
			.setTitle("Error")
			.setDescription(
				// biome-ignore lint/suspicious/noExplicitAny: why does it matter, it just works :tm:
				`Something went wrong:\n\`\`\`${String((err as any)?.message || err)}\`\`\``,
			)
			.setColor(0xff0000)
			.setFooter({ text: `You asked: ${userMessage}` });

		await interaction.editReply({ embeds: [errorEmbed] });
	}
}
