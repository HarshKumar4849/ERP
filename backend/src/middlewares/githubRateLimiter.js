const { rateLimit } = require('express-rate-limit');

// Rate limiter for proxy endpoints that query GitHub API
const githubProxyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'test' ? 500 : 120, // 120 requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    result: null,
    message: 'GitHub API rate limit protection triggered. Please wait before refreshing repository activity.',
  },
});

// Stricter rate limiter for manual reconciliation sync
const githubSyncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 200 : 10, // 10 syncs per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    result: null,
    message: 'Too many synchronization requests. Please wait a minute before re-syncing.',
  },
});

module.exports = {
  githubProxyLimiter,
  githubSyncLimiter,
};
