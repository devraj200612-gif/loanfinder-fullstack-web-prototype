'use strict';

// Minimal fixed-window in-memory rate limiter for sensitive endpoints.
// Suitable for a single-process prototype; replace with a shared store if the
// API is ever deployed across multiple instances.
//
// Usage:
//   app.use('/api/auth', createRateLimiter({ windowMs: 60_000, max: 10 }));
//
// Only POST requests are counted (credential attempts); GET probes such as
// /api/auth/me pass through untouched. Keyed by client IP.

function createRateLimiter({ windowMs, max, message = 'Too many requests, please try again shortly.' }) {
  if (!Number.isInteger(max) || max <= 0) throw new Error('rate limiter: max must be a positive integer');
  if (!Number.isInteger(windowMs) || windowMs <= 0) throw new Error('rate limiter: windowMs must be a positive integer');

  const hits = new Map(); // ip -> { count, resetAt }
  let lastPruneAt = 0;

  return function rateLimit(req, res, next) {
    if (req.method !== 'POST') return next();

    const now = Date.now();
    if (now - lastPruneAt > windowMs) {
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(key);
      }
      lastPruneAt = now;
    }

    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ status: 429, error: message });
    }
    next();
  };
}

module.exports = { createRateLimiter };
