const express = require('express');
const db = require('../db');
const { likeLimiter } = require('../ratelimiters/ratelimiters');

const router = express.Router();

// This route lists approved locations. It is public and accepts optional category and area filters. For example, /api/locations?category=park&area=Bishan
router.get('/', (req, res) => {
  const { category, area } = req.query;

  let sql = "SELECT * FROM locations WHERE status = 'approved'";
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (area) {
    sql += ' AND area = ?';
    params.push(area);
  }

  const rows = db.prepare(sql).all(...params);
  const locations = rows.map((row) => ({ ...row, tags: JSON.parse(row.tags) }));
  res.json(locations);
});

// This route increments a location's like count. It is public and this endpoint alone does not prevent repeatED clicks, although the frontend handles that itself using localStorage
router.post('/:id/like', likeLimiter, (req, res) => {
  const result = db
    .prepare('UPDATE locations SET like_count = like_count + 1 WHERE id = ?')
    .run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Location not found' });
  }

  const row = db.prepare('SELECT like_count FROM locations WHERE id = ?').get(req.params.id);
  res.json({ like_count: row.like_count });
});

module.exports = router;