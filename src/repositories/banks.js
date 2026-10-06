'use strict';

// Bank repository: read-only queries over the `banks` table.

const { getDb } = require('../db');

/** All banks, stable order. Returns plain rows { id, name, short_code }. */
function listAll(db) {
  const handle = db || getDb();
  if (!handle) return null;
  return handle.prepare('SELECT id, name, short_code FROM banks ORDER BY id').all();
}

module.exports = { listAll };