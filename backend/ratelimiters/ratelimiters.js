const rateLimit = require('express-rate-limit');

// Contributions are infrequent and one off. Limit is set low to stop spam scripts quickly
const contributeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP — please try again later.' },
});

// Likes happen more often during normal browsing. Limit is set higher, just enough to block spam without affecting normal use.
const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

module.exports = { contributeLimiter, likeLimiter };
