const express = require('express');
const cors = require('cors');
const path = require('node:path');

const locationsRouter = require('./routes/locations');
const contributionsRouter = require('./routes/contributions');
const adminRouter = require('./routes/admin');

const app = express();

app.use(cors()); // kept for flexibility, though same-origin below means it's no longer required for normal use
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves admin.html
app.use(express.static(path.join(__dirname, '..', 'frontend'))); // serves index.html, styles.css, app.js, etc.

app.use('/api/locations', locationsRouter);
app.use('/api/contributions', contributionsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pawventures API running on http://localhost:${PORT}`);
});
