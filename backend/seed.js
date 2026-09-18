// This script imports backend/seed-data/*.json (npm run seed, npm start) into the locations table
// It is safe to run more than once, since existing rows are matched by id and left alone
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

// Each entry names a seed file and the category every location in it belongs to
// Add a new { file, category } pair here whenever a new category gets its own seed file
const SEED_FILES = [
  { file: 'parks.json', category: 'park' },
  { file: 'malls.json', category: 'mall' },
];

// Checks whether a row already exists, purely so the console summary below can report
// new vs. updated counts separately — it plays no role in the upsert logic itself
const existsStmt = db.prepare('SELECT 1 FROM locations WHERE id = ?');

// Re-running this after editing the JSON syncs those changes onto existing rows
// like_count and status stay untouched.. Those reflect real activities, not static content
const upsert = db.prepare(`
  INSERT INTO locations
    (id, category, name, area, lat, lng, address, size, hours, tags, note, like_count, status)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved')
  ON CONFLICT(id) DO UPDATE SET
    category = excluded.category,
    name = excluded.name,
    area = excluded.area,
    lat = excluded.lat,
    lng = excluded.lng,
    address = excluded.address,
    size = excluded.size,
    hours = excluded.hours,
    tags = excluded.tags,
    note = excluded.note
`);

let totalNew = 0;
let totalUpdated = 0;
let totalRead = 0;

for (const { file, category } of SEED_FILES) {
  const filePath = path.join(__dirname, 'seed-data', file);

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} — not found at backend/seed-data/${file}`);
    continue;
  }

  const locations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  totalRead += locations.length;

  for (const loc of locations) {
    const alreadyExists = !!existsStmt.get(loc.id);

    upsert.run(
      loc.id,
      category,
      loc.name,
      loc.area,
      loc.lat,
      loc.lng,
      loc.address,
      loc.size || null,
      loc.hours,
      JSON.stringify(loc.tags || []),
      loc.note,
    );

    if (alreadyExists) totalUpdated++;
    else totalNew++;
  }
}

console.log(`Seeded ${totalNew} new location(s), updated ${totalUpdated} existing — ${totalRead} total across all seed files.`);