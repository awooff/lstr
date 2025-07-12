import { Glob } from "bun";
import { REST, Routes } from "discord.js";
import { elster } from "./elster";
import { logger } from "./logger";

export const commands: any[] = [];

export const fetchCommands = async () => {
	const glob = new Glob("*.ts");

	for await (const filePath of glob.scan("./src/commands")) {
		const command = await import(`./commands/${filePath}`);

		const commandModule = command.default || command;

		if ("data" in commandModule && "execute" in commandModule) {
			logger.info(`found ${commandModule.data.name}, registering..`);
			commands.push(commandModule.data.toJSON());
			elster.commands.set(commandModule.data.name, commandModule);
		} else {
			logger.warn(
				`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
			);
		}
	}
};

export const deployCommands = async () => {
	const rest = new REST().setToken(Bun.env.DISCORD_TOKEN!);

	// and deploy your commands!
	try {
		const data = await rest.put(
			Routes.applicationGuildCommands(Bun.env.CLIENT_ID!, Bun.env.GUILD_ID!),
			{ body: commands },
		);

		logger.info(
			`Successfully reloaded ${(data as any).length} application (/) commands.`,
		);
	} catch (error) {
		logger.error(error);
	}
};
