'use strict';

// Minimal, prototype-safe database migration runner for SQLite + better-sqlite3.
// Policy:
// - Migrations are .sql files named 0001_*.sql, 0002_*.sql, ... under db/migrations
// - Applied in numeric order and recorded in schema_migrations (id, applied_at)
// - Idempotent: uses IF NOT EXISTS, CREATE TABLE IF NOT EXISTS etc in SQL
// - Called by src/db.js on startup and by scripts/init-db.js before seed

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const SCHEMA_MIGRATIONS = 'schema_migrations';

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const na = parseInt(a.split('_')[0], 10);
      const nb = parseInt(b.split('_')[0], 10);
      if (na < nb) return -1;
      if (na > nb) return 1;
      return a.localeCompare(b);
    });
}

function ensureSchemaMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_MIGRATIONS} (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getApplied(db) {
  const rows = db.prepare(`SELECT id FROM ${SCHEMA_MIGRATIONS} ORDER BY id`).all();
  return new Set(rows.map(r => r.id));
}

function runMigrations(db) {
  ensureSchemaMigrationsTable(db);
  const applied = getApplied(db);
  const all = listMigrations();
  if (all.length === 0) return { applied: 0, migrations: [] };
  let n = 0;
  for (const fname of all) {
    const id = parseInt(fname.split('_')[0], 10);
    if (applied.has(id)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fname), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO ${SCHEMA_MIGRATIONS} (id, name, applied_at) VALUES (?, ?, datetime('now'))`).run(id, fname);
    });
    tx();
    n++;
  }
  return { applied: n, migrations: all };
}

module.exports = { runMigrations, MIGRATIONS_DIR };
