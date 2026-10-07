// LoanFinder API - Phase 2A/2C/2D backend.
// Phase 2E adds auth + saved offers (read-only original data routes remain intact).
'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const apiRouter = require('./src/routes/api');
const authRouter = require('./src/routes/auth');
const savedOffersRouter = require('./src/routes/saved-offers');

const ROOT = __dirname;
const DEFAULT_PORT = 8080;

const app = express();
app.disable('x-powered-by');

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LoanFinder API' });
});

// Auth
app.use('/api/auth', authRouter);

// Saved offers (auth-protected)
app.use('/api/saved-offers', savedOffersRouter);

// Static frontend
const STATIC_FILES = new Set(['/', '/index.html', '/styles.css', '/app.js', '/api.js']);
const VENDOR_FILE = /^\/vendor\/(?:[^/]+\/)*[^/]+\.(?:js|css|png)$/;
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (STATIC_FILES.has(req.path) || VENDOR_FILE.test(req.path)) return next();
  res.status(404).json({ status: 404, error: 'Not found' });
});
app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'ignore', fallthrough: true }));

// Read-only data API
app.use('/api', apiRouter);

// 404s
app.use('/api', (req, res) => {
  res.status(404).json({ status: 404, error: 'Not found' });
});
app.use((req, res) => {
  res.status(404).json({ status: 404, error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[LoanFinder API] error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ status: 500, error: 'Internal Server Error' });
});

function resolvePort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`[LoanFinder API] invalid PORT "${value}", using ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
  }
  return port;
}

function start(port = resolvePort(process.env.PORT)) {
  const server = app.listen(port, () => {
    console.log(`LoanFinder API listening on port ${server.address().port}`);
  });
  return server;
}

function shutdown(server, signal, done) {
  console.log(`[LoanFinder API] ${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log('[LoanFinder API] closed cleanly');
    done();
  });
  const force = setTimeout(() => {
    console.warn('[LoanFinder API] forced shutdown after timeout');
    done();
  }, 5000);
  if (force.unref) force.unref();
}

if (require.main === module) {
  const server = start();
  server.on('error', (err) => {
    console.error('[LoanFinder API] failed to start:', err.message);
    process.exit(1);
  });
  let closing = false;
  const exitOnce = (signal) => {
    if (closing) return;
    closing = true;
    shutdown(server, signal, () => process.exit(0));
  };
  process.on('SIGINT', () => exitOnce('SIGINT'));
  process.on('SIGTERM', () => exitOnce('SIGTERM'));
}

module.exports = { app, start, DEFAULT_PORT };
