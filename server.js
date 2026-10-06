// LoanFinder API - Phase 2A/2C backend.
//
// Scope: a minimal Express server with a health endpoint (Phase 2A) plus a
// read-only REST data layer on top of the Phase 2B SQLite database (Phase 2C).
// No write endpoints, no authentication. Static serving of the existing Phase 1
// frontend remains additive: the frontend still runs from file://, still uses
// its own BANK_OFFERS / BRANCH_DATA / localStorage and is NOT migrated to these
// APIs yet (that is Phase 2D).
'use strict';

const path = require('path');
const express = require('express');

const apiRouter = require('./src/routes/api');

const ROOT = __dirname;
const DEFAULT_PORT = 8080;

const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Health endpoint (Phase 2A contract, unchanged).
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LoanFinder API' });
});

// ---------------------------------------------------------------------------
// Static frontend.
//
// Only the files the Phase 1 app actually needs are published: index.html,
// styles.css, app.js and vendor/. Everything else in the project folder
// (node_modules, tests, .git, reports, package.json) stays private.
// ---------------------------------------------------------------------------
const STATIC_FILES = new Set(['/', '/index.html', '/styles.css', '/app.js']);
const VENDOR_FILE = /^\/vendor\/(?:[^/]+\/)*[^/]+\.(?:js|css|png)$/;

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (STATIC_FILES.has(req.path) || VENDOR_FILE.test(req.path)) return next();
  res.status(404).json({ status: 404, error: 'Not found' });
});

app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'ignore', fallthrough: true }));

// ---------------------------------------------------------------------------
// Read-only data API (Phase 2C: banks, loan offers, branches, hidden charges).
// ---------------------------------------------------------------------------
app.use('/api', apiRouter);

// ---------------------------------------------------------------------------
// 404 for unknown routes (API and everything else).
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ status: 404, error: 'Not found' });
});

app.use((req, res) => {
  res.status(404).json({ status: 404, error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Basic error handling: log it, never leak a stack trace to the client.
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[LoanFinder API] error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ status: 500, error: 'Internal Server Error' });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
function resolvePort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`[LoanFinder API] invalid PORT "${value}", using ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
  }
  return port;
}

/** Start the server. Pass 0 to let the OS pick a free port (used by tests). */
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
  // Do not hang forever on a stuck socket.
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
