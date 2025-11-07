import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { db } from '~/db'

// Check if the count is initialized
const countCheck = db.query("SELECT COUNT(*) as count FROM counts").get() as { count: number };
if (countCheck.count === 0) {
	db.exec("INSERT INTO counts (current_count) VALUES (0);");
}

const data = new SlashCommandBuilder()
	.setName("count")
	.setDescription(`Hit the target number of: ${Bun.env.COUNT_TARGET}`)
	.addStringOption((option) =>
		option
			.setName("operator")
			.setDescription("The mathematical operator")
			.setRequired(true)
			.addChoices(
				{ name: "Add", value: "add" },
				{ name: "Subtract", value: "sub" },
				{ name: "Multiply", value: "mul" },
				{ name: "Power", value: "pow" },
				{ name: "Modulo", value: "mod" },
				{ name: "Divide", value: "div" }
			))
	.addIntegerOption(option =>
		option
			.setName("amount")
			.setDescription("The number you want to use")
			.setRequired(true));

export default {
	data,
	execute: async (interaction: ChatInputCommandInteraction) => {
		let countTarget = parseInt(Bun.env.COUNT_TARGET || "100");
		const operation = interaction.options.getString("operator", true);
		const value = interaction.options.getInteger("amount", true);
		
		const countResult = db.query("SELECT current_count FROM counts LIMIT 1").get() as { current_count: number };
		const currentCount = countResult.current_count;
		
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
				if (value === 0) {
					await interaction.reply("Error: Modulo by zero is not allowed.");
					return;
				}
				newCount = currentCount % value;
				break;
			case "div":
				if (value === 0) {
					await interaction.reply("Error: Division by zero is not allowed.");
					return;
				}
				newCount = Math.floor(currentCount / value);
				break;
			default:
				await interaction.reply("Invalid operation. Please use add, sub, mul, pow, mod or div.");
				return;
		}
		
		db.query("UPDATE counts SET current_count = ?").run(newCount);
		
		const updatedResult = db.query("SELECT current_count FROM counts LIMIT 1").get() as { current_count: number };
		const updatedCount = updatedResult.current_count;
		
		await interaction.reply(`Current count is now: ${updatedCount}`);
		
		if (updatedCount === countTarget) {
			await interaction.followUp(`You've reached the target count of ${countTarget}!`);
			countTarget = Math.floor(Math.random() * 329945);
			// Note: You'll need to store this new target somewhere persistent
			await interaction.followUp(`New count number: ${countTarget}`);
		}
	}
};
