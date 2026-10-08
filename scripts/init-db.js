'use strict';

// LoanFinder database initializer + seeder (Phase 2B, refreshed in Phase 2D,
// made non-destructive in Phase 2E, body restored in Phase 2G).
//
// Behaviour:
//   - Creates data/loanfinder.sqlite (parent dir created on demand).
//   - Ensures schema exists via migrations (src/migrate.js) so existing tables
//     (including users/sessions/saved_offers) are preserved.
//   - Only drops/recreates the reference tables (banks, loan_offers, branches,
//     hidden_charges, meta) to seed fresh canonical data. User-owned tables
//     (users, sessions, saved_offers) are NEVER dropped and their data survives.
//   - saved_offers rows referencing offers that are absent from the fresh seed
//     are purged explicitly (they are true orphans once the offer is gone).
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

function buildReport(db) {
  const countBanks = db.prepare('SELECT COUNT(*) n FROM banks').get().n;
  const countOffers = db.prepare('SELECT COUNT(*) n FROM loan_offers').get().n;
  const countBranches = db.prepare('SELECT COUNT(*) n FROM branches').get().n;
  const countCharges = db.prepare('SELECT COUNT(*) n FROM hidden_charges').get().n;

  const homeOffers = db.prepare("SELECT COUNT(*) n FROM loan_offers WHERE loan_type = 'Home Loan'").get().n;
  const personalOffers = db.prepare("SELECT COUNT(*) n FROM loan_offers WHERE loan_type = 'Personal Loan'").get().n;

  const verifiedBranches = db.prepare("SELECT COUNT(*) n FROM branches WHERE verification_status = 'verified'").get().n;
  const demoBranches = db.prepare("SELECT COUNT(*) n FROM branches WHERE verification_status = 'demo'").get().n;
  const geotagged = db.prepare('SELECT COUNT(*) n FROM branches WHERE latitude IS NOT NULL AND longitude IS NOT NULL').get().n;
  const nullCoord = countBranches - geotagged;

  const perCity = db
    .prepare('SELECT city, COUNT(*) n FROM branches GROUP BY city ORDER BY city')
    .all()
    .map((r) => `${r.city}=${r.n}`)
    .join(', ');

  const offersByBank = db
    .prepare(
      'SELECT b.short_code AS short_code, COUNT(*) n FROM loan_offers o JOIN banks b ON b.id = o.bank_id GROUP BY b.id ORDER BY b.id'
    )
    .all()
    .map((r) => `${r.short_code}=${r.n}`)
    .join(', ');

  const fkIssues = db.pragma('foreign_key_check');

  return {
    banks: countBanks,
    offers: countOffers,
    homeOffers,
    personalOffers,
    branches: countBranches,
    hiddenChargeRows: countCharges,
    verifiedBranches,
    demoBranches,
    geotagged,
    nullCoord,
    perCity,
    offersByBank,
    foreignKeyViolations: fkIssues.length,
    dupes: {
      loanOffers: db.prepare('SELECT id, COUNT(*) n FROM loan_offers GROUP BY id HAVING n > 1').all().length,
      branches: db.prepare('SELECT id, COUNT(*) n FROM branches GROUP BY id HAVING n > 1').all().length,
      hiddenCharges: db.prepare('SELECT id, COUNT(*) n FROM hidden_charges GROUP BY id HAVING n > 1').all().length,
    },
  };
}

function seed(db, data) {
  const insertBank = db.prepare('INSERT INTO banks (id, name, short_code) VALUES (@id, @name, @short_code)');
  const insertOffer = db.prepare(`
    INSERT INTO loan_offers (
      id, bank_id, loan_type_id, loan_type, name, interest_rate, processing_fee_percent,
      processing_fee_max, max_amount, max_tenure, tag, tag_type, badge, color, eligibility,
      min_credit_score, min_monthly_income, employment_types, other_charges, last_updated,
      source_url, source_name, verification_status, last_verified_at
    ) VALUES (
      @id, @bank_id, @loan_type_id, @loan_type, @name, @interest_rate, @processing_fee_percent,
      @processing_fee_max, @max_amount, @max_tenure, @tag, @tag_type, @badge, @color, @eligibility,
      @min_credit_score, @min_monthly_income, @employment_types, @other_charges, @last_updated,
      @source_url, @source_name, @verification_status, @last_verified_at
    )`);
  const insertBranch = db.prepare(`
    INSERT INTO branches (
      id, bank_id, city, branch_name, address, hours, phone, latitude, longitude,
      geo_precision, ifsc, source_url, source_name, verification_status, last_verified_at
    ) VALUES (
      @id, @bank_id, @city, @branch_name, @address, @hours, @phone, @latitude, @longitude,
      @geo_precision, @ifsc, @source_url, @source_name, @verification_status, @last_verified_at
    )`);
  const insertCharge = db.prepare(`
    INSERT INTO hidden_charges (id, offer_id, name, description, fee_text, fee, fee_percent, icon, informational)
    VALUES (@id, @offer_id, @name, @description, @fee_text, @fee, @fee_percent, @icon, @informational)`);
  const insertMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');

  const store = db.transaction(() => {
    // Reference tables only, children before parents. user-owned tables
    // (users, sessions, saved_offers) are never touched here.
    db.exec('DELETE FROM hidden_charges');
    db.exec('DELETE FROM loan_offers');
    db.exec('DELETE FROM branches');
    db.exec('DELETE FROM banks');
    db.exec('DELETE FROM meta');

    for (const bank of data.banks) insertBank.run(bank);
    for (const offer of data.offers) insertOffer.run(offer);
    for (const branch of data.branches) insertBranch.run(branch);
    for (const charge of data.chargeRows) insertCharge.run(charge);

    const offersHash = sha256(data.offers.map((o) => ({ id: o.id, ...o })).sort((a, b) => (a.id < b.id ? -1 : 1)));
    const branchesHash = sha256(data.branches.map((b) => ({ id: b.id, ...b })).sort((a, b) => (a.id < b.id ? -1 : 1)));
    const chargesHash = sha256(data.chargeRows.map((c) => ({ id: c.id, ...c })).sort((a, b) => (a.id < b.id ? -1 : 1)));

    insertMeta.run('schema_version', SCHEMA_VERSION);
    insertMeta.run('seed_tool', SEED_TOOL);
    insertMeta.run('seeded_at', new Date().toISOString());
    insertMeta.run('offers_hash', offersHash);
    insertMeta.run('branches_hash', branchesHash);
    insertMeta.run('hidden_charges_hash', chargesHash);
    insertMeta.run(
      'counts',
      JSON.stringify({
        banks: data.banks.length,
        offers: data.offers.length,
        branches: data.branches.length,
        hiddenChargeRows: data.chargeRows.length,
      })
    );
  });
  store();
}

function assertParity(db, data) {
  const offerById = new Map(db.prepare('SELECT * FROM loan_offers').all().map((r) => [r.id, r]));
  const failures = [];

  for (const o of data.offers) {
    const row = offerById.get(o.id);
    if (!row) {
      failures.push(`offer ${o.id} missing`);
      continue;
    }
    const checks = [
      ['interest_rate', o.interest_rate],
      ['min_credit_score', o.min_credit_score],
      ['min_monthly_income', o.min_monthly_income],
      ['processing_fee_percent', o.processing_fee_percent],
      ['processing_fee_max', o.processing_fee_max],
      ['max_amount', o.max_amount],
      ['max_tenure', o.max_tenure],
    ];
    for (const [col, expected] of checks) {
      if (row[col] !== expected) failures.push(`offer ${o.id}: ${col} = ${row[col]}, expected ${expected}`);
    }
    if (row.employment_types !== o.employment_types) failures.push(`offer ${o.id}: employment_types mismatch`);
  }

  const branchById = new Map(db.prepare('SELECT * FROM branches').all().map((r) => [r.id, r]));
  for (const b of data.branches) {
    const row = branchById.get(b.id);
    if (!row) {
      failures.push(`branch ${b.id} missing`);
      continue;
    }
    function coordEqual(a, b2) {
      const isNull = (v) => v === null || v === undefined;
      if (isNull(a) && isNull(b2)) return true;
      if (isNull(a) !== isNull(b2)) return false;
      return Math.abs(a - b2) < 1e-9;
    }
    if (!coordEqual(row.latitude, b.latitude)) failures.push(`branch ${b.id}: latitude mismatch`);
    if (!coordEqual(row.longitude, b.longitude)) failures.push(`branch ${b.id}: longitude mismatch`);
    if (row.ifsc !== b.ifsc) failures.push(`branch ${b.id}: ifsc = ${row.ifsc}, expected ${b.ifsc}`);
    if (row.geo_precision !== b.geo_precision) failures.push(`branch ${b.id}: geo_precision mismatch`);
    if (row.verification_status !== b.verification_status) failures.push(`branch ${b.id}: verification_status mismatch`);
    if (row.city !== b.city) failures.push(`branch ${b.id}: city mismatch`);
  }

  if (failures.length > 0) {
    throw new Error(`Seed parity failures:\n  - ${failures.slice(0, 25).join('\n  - ')}`);
  }
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log('Loading source data from the canonical dataset (data/loanfinder-data.json)...');
  const frontend = loadFrontendData();
  checkSourceInvariants(frontend);
  const data = normalize(frontend);

  console.log(`Opening ${DB_PATH}...`);
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  console.log('Running migrations (existing user data is preserved)...');
  runMigrations(db);

  // Swap the reference tables only. FK enforcement is paused for the swap
  // because saved_offers rows reference loan_offers ids that are deleted and
  // re-inserted inside the transaction; orphans are purged right after.
  db.pragma('foreign_keys = OFF');
  try {
    console.log('Clearing and re-seeding reference tables (single transaction)...');
    seed(db, data);
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const purged = db
    .prepare('DELETE FROM saved_offers WHERE offer_id NOT IN (SELECT id FROM loan_offers)')
    .run();
  if (purged.changes > 0) {
    console.log(`Purged ${purged.changes} orphaned saved_offer row(s) whose offers no longer exist.`);
  }

  const fkIssues = db.pragma('foreign_key_check');
  if (fkIssues.length > 0) {
    db.close();
    throw new Error(`Foreign key violations after seed: ${JSON.stringify(fkIssues.slice(0, 10))}`);
  }

  assertParity(db, data);

  const report = buildReport(db);
  db.close();

  console.log('\n=== DATABASE INITIALIZATION OK ===');
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (e) {
  console.error('\nDATABASE INITIALIZATION FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
}
