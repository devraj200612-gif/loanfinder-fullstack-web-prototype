'use strict';

// Hidden-charges repository: read-only queries over `hidden_charges`.

const { getDb } = require('../db');

/**
 * Hidden charges for an offer id (e.g. 'sbi-home').
 * Empty (but valid) offers return an empty array. Returns null only when the
 * database handle is unavailable; offer existence is checked by the route.
 */
function listByOffer(db, offerId) {
  const h = db || getDb();
  if (!h) return null;
  return h
    .prepare(
      `SELECT id, offer_id, name, description, fee_text, fee, fee_percent
       FROM hidden_charges WHERE offer_id = ? ORDER BY id`
    )
    .all(String(offerId));
}

module.exports = { listByOffer };