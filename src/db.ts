import {Database} from "bun:sqlite"

export const db = new Database(
	":memory:",
	{strict: true}
)

db.exec(`
  CREATE TABLE IF NOT EXISTS counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_count INTEGER NOT NULL
  );
`);

db.exec("INSERT INTO counts (current_count) VALUES (0);");
