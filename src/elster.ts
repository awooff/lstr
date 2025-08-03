import {
	Client,
	Collection,
	Events,
	GatewayIntentBits,
	MessageFlags,
} from "discord.js"
import { deployCommands, fetchCommands } from "./commands"
import { logger } from "./logger"
import { generateText, loadTrainingData, markovChain } from "./commands/markov"

declare module "discord.js" {
	interface Client {
		commands: Collection<string, any>
	}
}

export const elster = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

elster.once(Events.ClientReady, (readyClient) => {
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`)
})

elster.commands = new Collection()

await fetchCommands()
await deployCommands()

elster.on('messageCreate', async (message) => {
    // Check if the message is from a bot or if it's empty
    if (message.author.bot || !message.content) return;

    // Fetch the last 100 messages and update the Markov chain
    const channel = message.channel;
    const result = await loadTrainingData(channel);

    // Check if the Markov chain has been trained with at least 100 messages
    if (result.success && markovChain.size >= 100) {
        // Generate a message using the Markov chain
        const generatedMessage = generateText(50); // Adjust length as needed
        await channel.send(generatedMessage as any);
    }
});


elster.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return

	const command = interaction.client.commands.get(interaction.commandName)

	if (!command) {
		logger.error(`No command matching ${interaction.commandName} was found.`)
		return
	}

	try {
		await command.execute(interaction)
	} catch (error) {
		logger.error(error)
		if (interaction.replied || interaction.deferred)
			await interaction.followUp({
				content: "There was an error while executing this command!",
				flags: MessageFlags.Ephemeral,
			})

		await interaction.reply({
			content: "There was an error while executing this command!",
			flags: MessageFlags.Ephemeral,
		})
	}
})
