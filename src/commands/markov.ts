import { SlashCommandBuilder } from "discord.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { logger } from "~/logger";

// Markov chain state
let markovChain = new Map();
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

const extractTextFromObject = (obj: any) => {
	const contentFields = ["content", "message", "text", "body", "msg"];

	for (const field of contentFields) {
		if (obj[field] && typeof obj[field] === "string") {
			return obj[field];
		}
	}

	// If no common field found, try to find any string value
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string" && value.length > 10) {
			return value;
		}
	}

	return null;
};

// Find content column index in CSV headers
const findContentColumnIndex = (headers) => {
	const contentFields = ["content", "message", "text", "body", "msg"];

	for (const field of contentFields) {
		const index = headers.findIndex((h: string) =>
			h.toLowerCase().includes(field.toLowerCase()),
		);
		if (index !== -1) {
			return index;
		}
	}

	return -1;
};

// Parse CSV line with proper quote handling
const parseCSVLine = (line: string) => {
	const result = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			result.push(current);
			current = "";
		} else {
			current += char;
		}
	}

	result.push(current);
	return result;
};

// Load JSON file
const loadJSON = (content: string) => {
	const data = JSON.parse(content);

	if (Array.isArray(data)) {
		// Array of message objects
		for (const item of data) {
			const text = extractTextFromObject(item);
			if (text) {
				addTextToChain(text);
			}
		}
	} else if (typeof data === "object") {
		// Single object or nested structure
		const text = extractTextFromObject(data);
		if (text) {
			addTextToChain(text);
		}
	}
};

// Load CSV file
const loadCSV = (content: any) => {
	const lines = content.split("\n");
	if (lines.length < 2) return;

	const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
	const contentIndex = findContentColumnIndex(headers);

	if (contentIndex === -1) {
		console.log("Could not find content column in CSV. Headers:", headers);
		return;
	}

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const columns = parseCSVLine(line);
		if (columns.length > contentIndex) {
			const text = columns[contentIndex].trim().replace(/"/g, "");
			if (text && text.length > 0) {
				addTextToChain(text);
			}
		}
	}
};

// Load training data from files
function loadTrainingData() {
	// Clear existing data
	markovChain.clear();
	starters = [];

	const dataDir = "./data";
	const files = [];

	// Check for common file names
	const commonFiles = [
		"messages.csv",
		"messages.json",
		"discord_messages.csv",
		"discord_messages.json",
		"chat_log.csv",
		"chat_log.json",
	];

	for (const file of commonFiles) {
		const filePath = path.join(dataDir, file);
		if (existsSync(filePath)) {
			files.push(filePath);
		}
	}

	// If no common files found, try to find any CSV or JSON files
	if (files.length === 0) {
		try {
			const dirContents = readdirSync(dataDir);
			for (const file of dirContents) {
				if (file.endsWith(".csv") || file.endsWith(".json")) {
					files.push(path.join(dataDir, file));
				}
			}
		} catch (error) {
			logger.error("Could not read data directory:", (error as any).message);
			return { success: false, error: "Could not read data directory" };
		}
	}

	if (files.length === 0) {
		return {
			success: false,
			error: "No training data files found in ./data directory",
		};
	}

	let loadedFiles = 0;
	for (const file of files) {
		try {
			const content = readFileSync(file, "utf-8");
			const extension = path.extname(file).toLowerCase();

			if (extension === ".json") {
				loadJSON(content);
			} else if (extension === ".csv") {
				loadCSV(content);
			}

			loadedFiles++;
			console.log(`Loaded training data from: ${file}`);
		} catch (error) {
			console.error(`Error loading ${file}:`, error.message);
		}
	}

	isTrained = loadedFiles > 0;
	return {
		success: isTrained,
		filesLoaded: loadedFiles,
		chainSize: markovChain.size,
		starterCount: starters.length,
	};
}

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
					`📊 **Markov Chain Statistics**\n` +
					`🔗 Chain size: ${markovChain.size}\n` +
					`🎯 Sentence starters: ${starters.length}\n` +
					`⚙️ Order: 2 (bigram)\n` +
					`📁 Data directory: ./data`,
				ephemeral: true,
			});
		}
	},
};
