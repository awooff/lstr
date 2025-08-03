import {Database} from "bun:sqlite"

const db = new Database(":memory:", {strict: true})

// create a few tables
db.exec(`
  CREATE TABLE counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_count INTEGER NOT NULL
  );
`);

db.exec("INSERT INTO counts (current_count) VALUES (0);");
