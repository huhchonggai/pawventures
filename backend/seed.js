// This script imports backend/seed-data/*.json (npm run seed) into the locations table.
// It is safe to run more than once, since existing rows are matched by id and left alone.
//
// By default it only reports rows that look orphaned (source = 'seed' and no longer present
// in the matching file) without deleting anything. Pass --prune to actually delete them:
//   node seed.js --prune
// Rows added live through POST /admin/locations are tagged source = 'admin' and are never
// touched by pruning, no matter what is or isn't in the JSON files.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const shouldPrune = process.argv.includes('--prune');

// Each entry names a seed file and the category every location in it belongs to
// Add a new { file, category } pair here whenever a new category gets its own seed file
const SEED_FILES = [
  { file: 'parks.json', category: 'park' },
  { file: 'malls.json', category: 'mall' },
  { file: 'eats.json', category: 'eat' },
];

// Checks whether a row already exists, purely so the console summary below can report
// new vs. updated counts separately — it plays no role in the upsert logic itself
const existsStmt = db.prepare('SELECT 1 FROM locations WHERE id = ?');

// Re-running this after editing the JSON syncs those changes onto existing rows
// like_count and status stay untouched.. Those reflect real activities, not static content
const upsert = db.prepare(`
  INSERT INTO locations
    (id, category, name, area, lat, lng, address, size, hours, tags, note, like_count, status, source)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved', 'seed')
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
let totalPruned = 0;

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

    if (loc.lat == null || loc.lng == null) {
      throw new Error(`${file}: "${loc.id}" is missing lat/lng (lat=${loc.lat}, lng=${loc.lng}) — fix this entry and re-run.`);
    }

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

  // This file is the confirmed list for rows this script owns (source = 'seed') in this
  // category. Admin added rows (source = 'admin') are never matched, so they're always safe.
  const currentIds = locations.map((loc) => loc.id);
  if (currentIds.length > 0) {
    const placeholders = currentIds.map(() => '?').join(',');
    const orphans = db
      .prepare(`SELECT id FROM locations WHERE category = ? AND source = 'seed' AND id NOT IN (${placeholders})`)
      .all(category, ...currentIds);

    if (orphans.length > 0) {
      if (shouldPrune) {
        const pruneStmt = db.prepare(
          `DELETE FROM locations WHERE category = ? AND source = 'seed' AND id NOT IN (${placeholders})`
        );
        const result = pruneStmt.run(category, ...currentIds);
        console.log(`Pruned ${result.changes} old "${category}" row(s) no longer present in ${file}: ${orphans.map((o) => o.id).join(', ')}`);
        totalPruned += result.changes;
      } else {
        console.log(`${orphans.length} "${category}" row(s) in the DB are not in ${file} (run with --prune to delete): ${orphans.map((o) => o.id).join(', ')}`);
      }
    }
  }
}

console.log(`Seeded ${totalNew} new location(s), updated ${totalUpdated} existing, pruned ${totalPruned} removed — ${totalRead} total across all seed files.`);
if (!shouldPrune && totalPruned === 0) {
  console.log('(Dry-run only for orphans — nothing was deleted. Re-run with --prune once you\'ve reviewed the list above.)');
}