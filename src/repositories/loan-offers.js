'use strict';

// Loan-offer repository: read-only queries over `loan_offers`, always joined to
// the owning bank and shaped into the API representation:
//
//   { id, loan_type_id, loan_type, name, interest_rate, processing_fee_percent,
//     processing_fee_max, max_amount, max_tenure, tag, tag_type, badge, color,
//     eligibility, min_credit_score, min_monthly_income, employment_types (array),
//     other_charges, last_updated, source_url, source_name, verification_status,
//     last_verified_at, bank: { id, name, short_code } }
//
// `employment_types` is stored as JSON text in SQLite and is parsed here into an
// array for API consumers (the frontend uses arrays); unparseable values pass
// through unchanged so no data is ever silently rewritten.

const { getDb } = require('../db');

const OFFER_FIELDS = `
  o.id, o.loan_type_id, o.loan_type, o.name, o.interest_rate,
  o.processing_fee_percent, o.processing_fee_max, o.max_amount, o.max_tenure,
  o.tag, o.tag_type, o.badge, o.color, o.eligibility,
  o.min_credit_score, o.min_monthly_income, o.employment_types,
  o.other_charges, o.last_updated, o.source_url, o.source_name,
  o.verification_status, o.last_verified_at
`;

const JOIN_BANK = `
  FROM loan_offers o
  JOIN banks b ON b.id = o.bank_id
`;

function shape(row) {
  if (!row) return null;
  let employmentTypes = row.employment_types;
  if (typeof employmentTypes === 'string') {
    try {
      employmentTypes = JSON.parse(employmentTypes);
    } catch (e) {
      // keep the raw string; never destructively rewrite data.
    }
  }
  return {
    id: row.id,
    loan_type_id: row.loan_type_id,
    loan_type: row.loan_type,
    name: row.name,
    interest_rate: row.interest_rate,
    processing_fee_percent: row.processing_fee_percent,
    processing_fee_max: row.processing_fee_max,
    max_amount: row.max_amount,
    max_tenure: row.max_tenure,
    tag: row.tag,
    tag_type: row.tag_type,
    badge: row.badge,
    color: row.color,
    eligibility: row.eligibility,
    min_credit_score: row.min_credit_score,
    min_monthly_income: row.min_monthly_income,
    employment_types: employmentTypes,
    other_charges: row.other_charges,
    last_updated: row.last_updated,
    source_url: row.source_url,
    source_name: row.source_name,
    verification_status: row.verification_status,
    last_verified_at: row.last_verified_at,
    bank: {
      id: row.bank_id,
      name: row.bank_name,
      short_code: row.bank_short_code
    }
  };
}

function handle(db) {
  return db || getDb();
}

/** All offers. Optional loan_type_id filter (e.g. 'home'). */
function list(db, loanTypeId) {
  const h = handle(db);
  if (!h) return null;
  let rows;
  if (loanTypeId === undefined || loanTypeId === null || loanTypeId === '') {
    rows = h.prepare(`SELECT ${OFFER_FIELDS}, b.id AS bank_id, b.name AS bank_name, b.short_code AS bank_short_code ${JOIN_BANK} ORDER BY o.id`).all();
  } else {
    rows = h
      .prepare(`SELECT ${OFFER_FIELDS}, b.id AS bank_id, b.name AS bank_name, b.short_code AS bank_short_code ${JOIN_BANK} WHERE o.loan_type_id = ? ORDER BY o.id`)
      .all(String(loanTypeId));
  }
  return rows.map(shape);
}

/** Single offer by id (e.g. 'sbi-home'). Returns null when absent. */
function findById(db, id) {
  const h = handle(db);
  if (!h) return null;
  const row = h
    .prepare(`SELECT ${OFFER_FIELDS}, b.id AS bank_id, b.name AS bank_name, b.short_code AS bank_short_code ${JOIN_BANK} WHERE o.id = ?`)
    .get(String(id));
  return shape(row);
}

module.exports = { list, findById };