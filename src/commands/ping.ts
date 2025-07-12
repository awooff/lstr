import { SlashCommandBuilder } from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("test if the bot is up or nah"),

	execute: async (interaction: any) => {
		await interaction.reply("pong!");
	},
};
