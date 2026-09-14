const express = require('express');
const db = require('../db');

const router = express.Router();

// This function checks a shared secret from the .env file
function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// This route lists contributions, filtered by status. Defaults to showing pending contributions. Also requires a admin key
router.get('/contributions', requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db
    .prepare('SELECT * FROM contributions WHERE status = ? ORDER BY created_at DESC')
    .all(status);
  res.json(rows);
});

// This route only marks a contribution as reviewed. It does not automatically create a location, since no coordinates are collected on the form
// Once you have looked up the coordinates yourself, add the location manually through POST /locations
router.post('/contributions/:id/approve', requireAdmin, (req, res) => {
  const result = db
    .prepare("UPDATE contributions SET status = 'approved' WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// This route marks a contribution as rejected
router.post('/contributions/:id/reject', requireAdmin, (req, res) => {
  const result = db
    .prepare("UPDATE contributions SET status = 'rejected' WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// This route creates a live, approved location directly. It replaces the old workflow of manually editing parks.json.
router.post('/locations', requireAdmin, (req, res) => {
  const { id, category, name, area, lat, lng, address, hours, tags, note } = req.body || {};

  if (!name || !area || !address || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'name, area, address, lat, and lng are required.' });
  }

  const finalId = id && id.trim() ? id.trim() : slugify(name);

  try {
    db.prepare(`
      INSERT INTO locations (id, category, name, area, lat, lng, address, hours, tags, note, like_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved')
    `).run(
      finalId,
      category || 'park',
      name,
      area,
      lat,
      lng,
      address,
      hours || null,
      JSON.stringify(tags || []),
      note || null,
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: `A location with id "${finalId}" already exists — try a different id.` });
    }
    throw err;
  }

  res.json({ ok: true, id: finalId });
});

// This function turns a name like "Jurong Lake Gardens Dog Run" into a URL-safe id like "jurong-lake-gardens-dog-run".
function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = router;