'use strict';

// Database access for the LoanFinder API.
// 
// Phase 2E: migration-aware, read+write connection. We open a single SQLite
// connection (with foreign_keys ON). On startup we run schema migrations (if any)
// via src/migrate.js so existing databases are adopted in place without losing
// user data. We default to WAL for better read/write behavior in a single-process
// dev server. A minimal health flag (hasError) replaces the old "missing handle"
// crash path so routes can return 500 cleanly.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrate');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'loanfinder.sqlite');

let _db = null;
let _error = null;

function open() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const db = new Database(DB_PATH, { readonly: false });
    db.pragma('foreign_keys = ON');
    try {
      db.pragma('journal_mode = WAL');
    } catch (e) {
      // ignore (not critical)
    }
    // Run migrations (0001+). For an existing DB, 0001 may apply nothing.
    runMigrations(db);
    _db = db;
    _error = null;
  } catch (e) {
    _db = null;
    _error = e;
  }
}

open();

function getDb() {
  return _db;
}

function dbError() {
  return _error;
}

function hasError() {
  return _db === null;
}

module.exports = { getDb, dbError, hasError, DB_PATH };
