import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import {db} from '~/db'

// Check if the count is initialized
const countCheck = db.query("SELECT COUNT(*) as count FROM counts").get();
if (countCheck === 0) {
	db.exec("INSERT INTO counts (current_count) VALUES (0);");
}

const data = new SlashCommandBuilder()
	.setName("count")
	.setDescription(`Hit the target number of: ${Bun.env.COUNT_TARGET}`)
		.addStringOption((option) =>
		option
			.setName("operator")
			.setDescription("The mathematical operator")
			.setRequired(true))
	.addIntegerOption(option =>
		option
			.setName("amount")
			.setDescription("The number you want to use")
			.setRequired(true))


export default {
	data,
	exectue: async (interaction: ChatInputCommandInteraction) => {
		let countTarget = Bun.env.COUNT_TARGET
		const operation = interaction.options.getString("operation", true);
		const value = interaction.options.getInteger("value", true);

		const currentCount = db.query("SELECT current_count FROM counts").get() as number;

		let newCount: number;

		switch (operation) {
			case "add":
				newCount = currentCount + value;
				break;
			case "sub":
				newCount = currentCount - value;
				break;
			case "mul":
				newCount = currentCount * value;
				break;
			case "pow":
				newCount = currentCount ** value;
				break;
			case "mod":
				newCount = currentCount % value;
				break;
			case "div":
				if (value === 0) {
					await interaction.reply("Error: Division by zero is not allowed.");
					return;
				}
				newCount = currentCount / value;
				break;
			default:
				await interaction.reply("Invalid operation. Please use add, sub, mul, pow, mod or div.");
				return;
		}

		db.exec("UPDATE counts SET current_count = ?", [newCount]);

		const updatedCount = db.query("SELECT current_count FROM counts").get();
		if (typeof updatedCount !== "number")
			await interaction.reply("something went wrong.")

		await interaction.reply(`Current count is now: ${updatedCount}`);

		if (updatedCount as number === countTarget) {
			await interaction.followUp(`You've reached the target count of ${countTarget}!`);
			countTarget = Math.floor(Math.random() * 329945)
			await interaction.followUp(`New count number: ${countTarget}`)
		}
	}
}
