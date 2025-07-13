import { elster } from "./elster";

declare module "bun" {
	interface Env {
		CLIENT_ID: string;
		GUILD_ID: string;
		DISCORD_TOKEN: string;
		HF_TOKEN: string;
	}
}

await elster.login();
