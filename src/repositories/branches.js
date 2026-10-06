'use strict';

// Branch repository: read-only queries over `branches`, joined to the owning
// bank. NULL stays NULL: records without verified coordinates or provenance are
// returned exactly as stored (see geo_precision / verification_status).

const { getDb } = require('../db');

const BRANCH_FIELDS = `
  br.id, br.city, br.branch_name, br.address, br.hours, br.phone,
  br.latitude, br.longitude, br.geo_precision, br.ifsc,
  br.source_url, br.source_name, br.verification_status, br.last_verified_at,
  br.bank_id, b.name AS bank_name, b.short_code AS bank_short_code
`;

function shape(row) {
  if (!row) return null;
  return {
    id: row.id,
    bank: {
      id: row.bank_id,
      name: row.bank_name,
      short_code: row.bank_short_code
    },
    city: row.city,
    branch_name: row.branch_name,
    address: row.address,
    hours: row.hours,
    phone: row.phone,
    latitude: row.latitude,
    longitude: row.longitude,
    geo_precision: row.geo_precision,
    ifsc: row.ifsc,
    source_url: row.source_url,
    source_name: row.source_name,
    verification_status: row.verification_status,
    last_verified_at: row.last_verified_at
  };
}

function handle(db) {
  return db || getDb();
}

/**
 * All branches. Optional exact city match filter.
 * An unknown city yields an empty array; only exact city names match
 * (Mumbai, Delhi, Bengaluru, Hyderabad, Pune).
 */
function list(db, city) {
  const h = handle(db);
  if (!h) return null;
  let rows;
  if (city === undefined || city === null || city === '') {
    rows = h.prepare(`SELECT ${BRANCH_FIELDS} FROM branches br JOIN banks b ON b.id = br.bank_id ORDER BY br.id`).all();
  } else {
    rows = h
      .prepare(`SELECT ${BRANCH_FIELDS} FROM branches br JOIN banks b ON b.id = br.bank_id WHERE br.city = ? ORDER BY br.id`)
      .all(String(city));
  }
  return rows.map(shape);
}

/** Single branch by id (slug). Returns null when absent. */
function findById(db, id) {
  const h = handle(db);
  if (!h) return null;
  const row = h
    .prepare(`SELECT ${BRANCH_FIELDS} FROM branches br JOIN banks b ON b.id = br.bank_id WHERE br.id = ?`)
    .get(String(id));
  return shape(row);
}

module.exports = { list, findById };