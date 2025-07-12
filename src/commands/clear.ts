import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
} from "discord.js";
import { logger } from "~/logger";

export default {
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Clear a specified number of messages from the channel")
		.addIntegerOption((option) =>
			option
				.setName("amount")
				.setDescription("Number of messages to delete (1-100)")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	execute: async (interaction: any) => {
		const amount = interaction.options.getInteger("amount");

		if (
			!interaction.member.permissions.has(PermissionFlagsBits.Administrator)
		) {
			return await interaction.reply({
				content: "You don't have permission to use this command!",
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			const messages = await interaction.channel.messages.fetch({
				limit: amount,
			});
			await interaction.channel.bulkDelete(messages);

			await interaction.reply({
				content: `Successfully deleted ${messages.size} messages!`,
				flags: MessageFlags.Ephemeral,
			});
			logger.info(`Successfully deleted ${messages.size} messages.`);
		} catch (error) {
			console.error("Error clearing messages:", error);
			await interaction.reply({
				content:
					"There was an error trying to clear messages. Make sure the messages are not older than 14 days.",
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
