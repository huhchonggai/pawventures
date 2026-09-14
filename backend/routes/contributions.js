const express = require('express');
const db = require('../db');
const { contributeLimiter } = require('../ratelimiters/ratelimiters');

const router = express.Router();

// This route is public and requires no authentication. Body includes a hidden honeypot field called "website".
router.post('/', contributeLimiter, (req, res) => {
  const { submitter_name, park_name, address, details, nearest_carpark, website } = req.body || {};

  if (website) {
    // Only a bot would fill this in
    return res.json({ ok: true });
  }

  if (!park_name || !address || !details) {
    return res.status(400).json({ error: 'park_name, address, and details are required.' });
  }

  db.prepare(`
    INSERT INTO contributions (submitter_name, park_name, address, details, nearest_carpark, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(submitter_name || null, park_name, address, details, nearest_carpark || null);

  res.json({ ok: true });
});

module.exports = router;