-- LoanFinder baseline schema (Phase 2B, migration 0001).
-- SQLite, prototype-grade, deliberately simple. No ORM.
-- Data is seeded from the canonical dataset snapshot (data/loanfinder-data.json)
-- so the database can never drift from the running application.
--
-- This file is applied by src/migrate.js and is idempotent (IF NOT EXISTS), so
-- a database created by the original db/schema.sql layout is adopted in place
-- without dropping anything.

-- --------------------------------------------------------------------------
-- banks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  short_code  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name)
);

-- --------------------------------------------------------------------------
-- loan_offers
-- --------------------------------------------------------------------------
-- One row per frontend BANK_OFFERS entry. `id` carries the frontend offer id
-- (e.g. 'sbi-home') for a stable, traceable mapping. Employment types arrive
-- from the frontend as an array and are stored as JSON text; normalizing into
-- a join table is unnecessary for this prototype and is documented here.
-- Source/verification columns exist to support provenance. The current offers
-- are sample/promo data drawn from the loan calculator: they have no source
-- URL from the frontend, so verification_status = 'sample' and the source and
-- last_verified_at fields are NULL. This mirrors the UI which labels these as
-- sample data; nothing is invented.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_offers (
  id                      TEXT PRIMARY KEY,
  bank_id                 INTEGER NOT NULL REFERENCES banks(id),
  loan_type_id            TEXT NOT NULL,
  loan_type               TEXT NOT NULL,
  name                    TEXT NOT NULL,
  interest_rate           REAL NOT NULL,
  processing_fee_percent  REAL NOT NULL,
  processing_fee_max      INTEGER NOT NULL,
  max_amount              INTEGER NOT NULL,
  max_tenure              INTEGER NOT NULL,
  tag                     TEXT,
  tag_type                TEXT,
  badge                   TEXT,
  color                   TEXT,
  eligibility             TEXT,
  min_credit_score        INTEGER,
  min_monthly_income      INTEGER,
  employment_types        TEXT,
  other_charges           TEXT,
  last_updated            TEXT,
  source_url              TEXT,
  source_name             TEXT,
  verification_status     TEXT NOT NULL DEFAULT 'sample',
  last_verified_at        TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bank_id, loan_type_id)
);

-- --------------------------------------------------------------------------
-- branches
-- --------------------------------------------------------------------------
-- One row per frontend BRANCH_DATA record. `id` is a deterministic slug of
-- city + branch name so re-seeding never duplicates. latitude/longitude are
-- NULL where the frontend marks coordinates unverified. geo_precision keeps
-- the exact frontend distinction ('demo' | 'locality' | 'branch' | NULL).
-- Provenance is preserved verbatim: ifsc and the original `source` string are
-- stored as-is; source_url holds the value only when it is a real URL, and
-- source_name holds a real non-URL provenance string when one exists (e.g.
-- the SBI Pune record's "public IFSC / RBI dataset ..." note). verification
-- status is derived: 'verified' when the record carries an IFSC + source,
-- 'demo' otherwise - the same 15-verified / 18-demo split the UI itself shows.
-- last_verified_at has no frontend value, so it stays NULL (not invented).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id                  TEXT PRIMARY KEY,
  bank_id             INTEGER NOT NULL REFERENCES banks(id),
  city                TEXT NOT NULL,
  branch_name         TEXT NOT NULL,
  address             TEXT,
  hours               TEXT,
  phone               TEXT,
  latitude            REAL,
  longitude           REAL,
  geo_precision       TEXT,
  ifsc                TEXT,
  source_url          TEXT,
  source_name         TEXT,
  verification_status TEXT NOT NULL DEFAULT 'demo',
  last_verified_at    TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bank_id, city, branch_name)
);

-- --------------------------------------------------------------------------
-- hidden_charges
-- --------------------------------------------------------------------------
-- Preserves the frontend HIDDEN_CHARGES fine-print dataset (keyed by offer id)
-- so no meaningful offer-level data is lost. fee_text preserves the original
-- display string (e.g. '₹6,000-12,000'); fee and fee_percent keep the numeric
-- representation. icon keeps the lucide glyph name the UI renders (Phase 2D:
-- the frontend now reads this data from the API and needs the icon back), and
-- informational marks rows that are purely disclosure (no charge) so the
-- frontend's cost estimate and "(informational)" badge keep working.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hidden_charges (
  id            TEXT PRIMARY KEY,
  offer_id      TEXT NOT NULL REFERENCES loan_offers(id),
  name          TEXT NOT NULL,
  description   TEXT,
  fee_text      TEXT,
  fee           REAL,
  fee_percent   INTEGER NOT NULL DEFAULT 0,
  icon          TEXT,
  informational INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (offer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loan_offers_bank   ON loan_offers(bank_id);
CREATE INDEX IF NOT EXISTS idx_loan_offers_type   ON loan_offers(loan_type_id);
CREATE INDEX IF NOT EXISTS idx_branches_bank      ON branches(bank_id);
CREATE INDEX IF NOT EXISTS idx_branches_city      ON branches(city);
CREATE INDEX IF NOT EXISTS idx_hidden_charges_offer ON hidden_charges(offer_id);

-- --------------------------------------------------------------------------
-- meta
-- --------------------------------------------------------------------------
-- Tracks the seed that produced this file so validation can confirm the
-- database was generated by this exact code and data snapshot. It holds seed
-- metadata only; schema history lives in schema_migrations (src/migrate.js).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
