// This file uses Node's built-in node:sqlite module. Requires no npm package and no native compilation step
// Node still marks it as "experimental," but that only means the API could change in a future Node version. It does not mean the module is unreliable to use
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'data', 'pawventures.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// WAL mode allows reads and writes to happen without blocking each other. This matters once more than one person is using the API at the same time
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'park',
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT NOT NULL,
    hours TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    note TEXT,
    like_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitter_name TEXT,
    park_name TEXT NOT NULL,
    address TEXT NOT NULL,
    details TEXT NOT NULL,
    nearest_carpark TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Adds the size column to locations tables created before this field existed
// SQLite has no "ADD COLUMN IF NOT EXISTS", so a duplicate column error here just means it already ran
try {
  db.exec('ALTER TABLE locations ADD COLUMN size TEXT;');
} catch (err) {
  if (!/duplicate column/i.test(err.message)) throw err;
}

module.exports = db;
