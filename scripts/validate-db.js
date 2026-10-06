'use strict';

// Read-only database validation for Phase 2B.
// Verifies the seeded data/loanfinder.sqlite against both the meta recorded at
// seed time and the live frontend source of truth (app.js). Exits non-zero on
// any mismatch. Safe to run any time; does not modify the database.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { loadFrontendData } = require('./extract-app-data');
const { normalize, checkSourceInvariants } = require('./data-pipeline');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'loanfinder.sqlite');
const SCHEMA_VERSION = '1';

const PASS = [];
const FAIL = [];

function record(name, ok, detail) {
  (ok ? PASS : FAIL).push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

function byId(a, b) {
  return a.id < b.id ? -1 : 1;
}

function pick(row, cols) {
  const out = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

const OFFER_COLS = [
  'id', 'bank_id', 'loan_type_id', 'loan_type', 'name', 'interest_rate', 'processing_fee_percent',
  'processing_fee_max', 'max_amount', 'max_tenure', 'tag', 'tag_type', 'badge', 'color', 'eligibility',
  'min_credit_score', 'min_monthly_income', 'employment_types', 'other_charges', 'last_updated',
  'source_url', 'source_name', 'verification_status', 'last_verified_at',
];
const BRANCH_COLS = [
  'id', 'bank_id', 'city', 'branch_name', 'address', 'hours', 'phone', 'latitude', 'longitude',
  'geo_precision', 'ifsc', 'source_url', 'source_name', 'verification_status', 'last_verified_at',
];
const CHARGE_COLS = ['id', 'offer_id', 'name', 'description', 'fee_text', 'fee', 'fee_percent'];

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}. Run 'npm run db:init' first.`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  db.pragma('foreign_keys = ON');

  const frontend = loadFrontendData();
  checkSourceInvariants(frontend);
  const expected = normalize(frontend);

  // ---- 1. tables exist ----
  const requiredTables = ['banks', 'loan_offers', 'branches', 'hidden_charges', 'meta'];
  const existing = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
  for (const t of requiredTables) record(`table '${t}' exists`, existing.has(t));
  const extra = Array.from(existing).filter((t) => !t.startsWith('sqlite_') && !requiredTables.includes(t));
  if (extra.length) record('no unexpected tables', false, extra.join(', '));

  // ---- 2. counts ----
  const counts = {
    banks: db.prepare('SELECT COUNT(*) n FROM banks').get().n,
    offers: db.prepare('SELECT COUNT(*) n FROM loan_offers').get().n,
    branches: db.prepare('SELECT COUNT(*) n FROM branches').get().n,
    hiddenChargeRows: db.prepare('SELECT COUNT(*) n FROM hidden_charges').get().n,
  };
  const expectCounts = {
    banks: expected.banks.length,
    offers: expected.offers.length,
    branches: expected.branches.length,
    hiddenChargeRows: expected.chargeRows.length,
  };
  for (const k of Object.keys(expectCounts)) {
    record(`count ${k}`, counts[k] === expectCounts[k], `${counts[k]} vs ${expectCounts[k]}`);
  }
  record('home offers = 5', db.prepare("SELECT COUNT(*) n FROM loan_offers WHERE loan_type='Home Loan'").get().n === 5);
  record('personal offers = 2', db.prepare("SELECT COUNT(*) n FROM loan_offers WHERE loan_type='Personal Loan'").get().n === 2);

  // ---- 3. foreign keys ----
  const fkViolations = db.pragma('foreign_key_check');
  record('no foreign-key violations', fkViolations.length === 0, `${fkViolations.length} violation(s)`);

  // ---- 4. duplicates ----
  const dupes = {
    banks: db.prepare('SELECT name, COUNT(*) n FROM banks GROUP BY name HAVING n > 1').all().length,
    loanOffers: db.prepare('SELECT id, COUNT(*) n FROM loan_offers GROUP BY id HAVING n > 1').all().length,
    branches: db.prepare('SELECT id, COUNT(*) n FROM branches GROUP BY id HAVING n > 1').all().length,
    hiddenCharges: db.prepare('SELECT id, COUNT(*) n FROM hidden_charges GROUP BY id HAVING n > 1').all().length,
  };
  const dupeTotal = Object.values(dupes).reduce((a, n) => a + n, 0);
  record('no duplicate seeded records', dupeTotal === 0, JSON.stringify(dupes));

  // ---- 5. provenance / verification breakdown ----
  const verified = db.prepare("SELECT COUNT(*) n FROM branches WHERE verification_status='verified'").get().n;
  const demo = db.prepare("SELECT COUNT(*) n FROM branches WHERE verification_status='demo'").get().n;
  const withIfsc = db.prepare('SELECT COUNT(*) n FROM branches WHERE ifsc IS NOT NULL').get().n;
  record('verified branches = 15 (IFSC+source)', verified === 15 && withIfsc === 15, `${verified} verified / ${withIfsc} with IFSC`);
  record('demo branches = 18', demo === 18, String(demo));
  const offerSample = db.prepare("SELECT COUNT(*) n FROM loan_offers WHERE verification_status='sample'").get().n;
  record('offers flagged sample', offerSample === counts.offers, `${offerSample}/${counts.offers}`);

  // ---- 6. parity with the live frontend data ----
  const dbOffers = db.prepare('SELECT * FROM loan_offers').all().map((r) => pick(r, OFFER_COLS)).sort(byId);
  const expOffers = expected.offers.map((r) => pick(r, OFFER_COLS)).sort(byId);
  const dbBranches = db.prepare('SELECT * FROM branches').all().map((r) => pick(r, BRANCH_COLS)).sort(byId);
  const expBranches = expected.branches.map((r) => pick(r, BRANCH_COLS)).sort(byId);
  const dbCharges = db.prepare('SELECT * FROM hidden_charges').all().map((r) => pick(r, CHARGE_COLS)).sort(byId);
  const expCharges = expected.chargeRows.map((r) => pick(r, CHARGE_COLS)).sort(byId);

  const cmp = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  record('loan_offers parity vs app.js', cmp(dbOffers, expOffers));
  record('branches parity vs app.js', cmp(dbBranches, expBranches));
  record('hidden_charges parity vs app.js', cmp(dbCharges, expCharges));

  // ---- 7. meta sanity ----
  const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
  record('meta: schema_version', meta.schema_version === SCHEMA_VERSION, meta.schema_version);
  const metaCounts = meta.counts ? JSON.parse(meta.counts) : null;
  record(
    'meta: counts match',
    !!metaCounts &&
      metaCounts.banks === counts.banks &&
      metaCounts.offers === counts.offers &&
      metaCounts.branches === counts.branches &&
      metaCounts.hiddenChargeRows === counts.hiddenChargeRows,
    meta.counts
  );

  db.close();

  console.log('\n=== DATABASE VALIDATION ===');
  for (const line of PASS) console.log(line);
  if (FAIL.length) {
    console.log('\nFAILURES:');
    for (const line of FAIL) console.log(line);
    console.error(`\nVALIDATION FAILED (${FAIL.length} problem(s))`);
    process.exit(1);
  }
  console.log(`\nVALIDATION PASSED (${PASS.length} checks)`);
}

try {
  main();
} catch (e) {
  console.error('\nVALIDATION ERROR:', e.message);
  process.exit(1);
}