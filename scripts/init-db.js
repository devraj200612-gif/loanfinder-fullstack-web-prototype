'use strict';

// LoanFinder database initializer + seeder (Phase 2B, refreshed in Phase 2D, made non-destructive in Phase 2E).
//
// Behaviour:
//   - Creates data/loanfinder.sqlite (parent dir created on demand).
//   - Ensures schema exists via migrations (src/migrate.js) so existing tables
//     (including users/sessions/saved_offers) are preserved.
//   - Only drops/recreates the reference tables (banks, loan_offers, branches,
//     hidden_charges, meta) to seed fresh canonical data. User-owned tables
//     (users, sessions, saved_offers) are NEVER dropped and their data survives.
//   - Writes a validation summary to stdout and exits non-zero on failure.
//
// The generated reference data is gitignored; this script is reproducible.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { loadFrontendData } = require('./extract-app-data');
const { normalize, checkSourceInvariants, sha256 } = require('./data-pipeline');
const { runMigrations } = require('../src/migrate');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'loanfinder.sqlite');

const SCHEMA_VERSION = '2';
const SEED_TOOL = 'scripts/init-db.js';
