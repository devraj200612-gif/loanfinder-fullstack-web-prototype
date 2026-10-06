'use strict';

// Database access for the LoanFinder API.
//
// A single read-only connection to the Phase 2B seed database
// (data/loanfinder.sqlite). Read-only means the API can never mutate data by
// accident. If the database is missing (fresh checkout before `npm run db:init`)
// the server still boots; routes detect the missing handle and return a clean
// 500 rather than crashing.

const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'loanfinder.sqlite');

let _db = null;
let _error = null;

function open() {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    db.pragma('foreign_keys = ON');
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

module.exports = { getDb, dbError, DB_PATH };