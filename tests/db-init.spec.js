// Phase 2G database lifecycle tests.
//
// The Phase 2F audit caught `scripts/init-db.js` silently degrading into a
// no-op stub: `npm run db:init` exited 0 doing nothing, which a pre-seeded
// local database masked completely. These tests make that regression
// impossible:
//   1. db:init must actually re-run (fresh seeded_at + OK marker) while
//      preserving users, sessions and saved_offers, and reference counts.
//   2. db:init must purge saved_offers rows whose offer no longer exists
//      (the promise made by migration 0002) without touching valid rows.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'loanfinder.sqlite');
const INIT = path.join(ROOT, 'scripts', 'init-db.js');

function runInit() {
  const r = spawnSync(process.execPath, [INIT], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function snapshot() {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const one = (sql) => db.prepare(sql).get();
    return {
      users: one('SELECT COUNT(*) n FROM users').n,
      sessions: one('SELECT COUNT(*) n FROM sessions').n,
      savedOffers: one('SELECT COUNT(*) n FROM saved_offers').n,
      banks: one('SELECT COUNT(*) n FROM banks').n,
      offers: one('SELECT COUNT(*) n FROM loan_offers').n,
      branches: one('SELECT COUNT(*) n FROM branches').n,
      charges: one('SELECT COUNT(*) n FROM hidden_charges').n,
      seededAt: one("SELECT value FROM meta WHERE key = 'seeded_at'").value,
      fkViolations: db.pragma('foreign_key_check').length,
    };
  } finally {
    db.close();
  }
}

test.afterAll(() => {
  // Remove sentinel users created by this file (cascades their sessions and
  // saved offers) so repeated runs do not accumulate rows.
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.prepare("DELETE FROM users WHERE email LIKE 'dbinit-%@example.com'").run();
  db.close();
});

test('1. db:init reseeds reference data and preserves users, sessions and saved offers', async ({ request }) => {
  const email = `dbinit-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', { data: { email, password: 'DbInitTest1' } });
  expect(reg.status()).toBe(201);
  const userId = (await reg.json()).data.user.id;

  const offers = await request.get('/api/loan-offers');
  const offerId = (await offers.json()).data[0].id;
  const save = await request.post('/api/saved-offers', { data: { offer_id: offerId } });
  expect(save.status()).toBe(201);

  const before = snapshot();

  const init = runInit();
  expect(init.status, init.stdout + init.stderr).toBe(0);
  // The no-op stub printed nothing and skipped this marker entirely.
  expect(init.stdout).toContain('DATABASE INITIALIZATION OK');

  const after = snapshot();

  // Proof the initializer really did work (fresh timestamp).
  expect(after.seededAt).not.toBe(before.seededAt);

  // Reference data intact and non-empty.
  expect(after.banks).toBe(before.banks);
  expect(after.offers).toBe(before.offers);
  expect(after.branches).toBe(before.branches);
  expect(after.charges).toBe(before.charges);
  expect(after.banks).toBeGreaterThan(0);
  expect(after.offers).toBeGreaterThan(0);
  expect(after.branches).toBeGreaterThan(0);
  expect(after.charges).toBeGreaterThan(0);

  // User-owned data untouched.
  expect(after.users).toBe(before.users);
  expect(after.sessions).toBe(before.sessions);
  expect(after.savedOffers).toBe(before.savedOffers);
  expect(after.fkViolations).toBe(0);

  const survivor = new Database(DB_PATH, { readonly: true })
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);
  expect(survivor).toBeTruthy();
  expect(Number(survivor.id)).toBe(Number(userId));
});

test('2. db:init purges orphaned saved_offers rows but keeps valid ones', async ({ request }) => {
  const email = `dbinit-orphan-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', { data: { email, password: 'DbInitTest1' } });
  expect(reg.status()).toBe(201);
  const userId = (await reg.json()).data.user.id;

  const offers = await request.get('/api/loan-offers');
  const offerId = (await offers.json()).data[0].id;
  await request.post('/api/saved-offers', { data: { offer_id: offerId } });

  // Insert an orphan directly (the API's FK checks prevent this path).
  {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO saved_offers (user_id, offer_id, created_at) VALUES (?, 'offer-from-beyond', datetime('now'))").run(userId);
    db.close();
  }

  const countFor = (sql, ...args) => {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      return db.prepare(sql).get(...args).n;
    } finally {
      db.close();
    }
  };
  const orphanSql = "SELECT COUNT(*) n FROM saved_offers WHERE offer_id = 'offer-from-beyond'";
  expect(countFor(orphanSql)).toBe(1);

  const init = runInit();
  expect(init.status, init.stdout + init.stderr).toBe(0);

  // The orphan is gone; the user's valid saved offer and account survive.
  expect(countFor(orphanSql)).toBe(0);
  expect(countFor('SELECT COUNT(*) n FROM saved_offers WHERE user_id = ?', userId)).toBe(1);
  expect(countFor('SELECT COUNT(*) n FROM users WHERE email = ?', email)).toBe(1);

  const after = snapshot();
  expect(after.fkViolations).toBe(0);
});
