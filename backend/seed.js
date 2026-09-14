// This script imports backend/seed-data/parks.json (npm run seed, npm start) into the locations table. It is safe to run more than once, since existing rows are matched by id and left alone.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const parksPath = path.join(__dirname, 'seed-data', 'parks.json');

if (!fs.existsSync(parksPath)) {
  console.error(`Could not find ${parksPath} — expected it at backend/seed-data/parks.json`);
  process.exit(1);
}

const parks = JSON.parse(fs.readFileSync(parksPath, 'utf-8'));

const insert = db.prepare(`
  INSERT OR IGNORE INTO locations
    (id, category, name, area, lat, lng, address, hours, tags, note, like_count, status)
  VALUES
    (?, 'park', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved')
`);

let seeded = 0;
for (const park of parks) {
  const result = insert.run(
    park.id,
    park.name,
    park.area,
    park.lat,
    park.lng,
    park.address,
    park.hours,
    JSON.stringify(park.tags || []),
    park.note,
  );
  if (result.changes > 0) seeded++;
}

console.log(`Seeded ${seeded} new location(s) — ${parks.length} total in parks.json.`);