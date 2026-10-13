// Phase 2G database lifecycle tests.
// Extended for deployment initialization requirements (demo account, repeat init, preservation).
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'loanfinder.sqlite');
const INIT = path.join(ROOT, 'scripts', 'init-db.js');

const DEMO_EMAIL = 'demo@loanfinder.in';
const DEMO_PASSWORD = 'demo1234';

function runInit(env = {}) {
  const r = spawnSync(process.execPath, [INIT], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign({}, process.env, env),
  });
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

function getDemoUser() {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?').get(DEMO_EMAIL);
  } finally {
    db.close();
  }
}

function countDemoUsers() {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare('SELECT COUNT(*) n FROM users WHERE email = ?').get(DEMO_EMAIL);
    return row ? row.n : 0;
  } finally {
    db.close();
  }
}

function countFor(sql, ...args) {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare(sql).get(...args);
    return row ? row.n : 0;
  } finally {
    db.close();
  }
}

test.afterAll(() => {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.prepare("DELETE FROM users WHERE email LIKE 'dbinit-%@example.com' OR email LIKE 'dbinit-orphan-%@example.com' OR email LIKE 'dbinitpw-%@example.com' OR email LIKE 'custom-demo@loanfinder.test'").run();
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
  expect(init.stdout).toContain('DATABASE INITIALIZATION OK');

  const after = snapshot();

  expect(after.seededAt).not.toBe(before.seededAt);
  expect(after.banks).toBe(before.banks);
  expect(after.offers).toBe(before.offers);
  expect(after.branches).toBe(before.branches);
  expect(after.charges).toBe(before.charges);
  expect(after.banks).toBeGreaterThan(0);
  expect(after.offers).toBeGreaterThan(0);
  expect(after.branches).toBeGreaterThan(0);
  expect(after.charges).toBeGreaterThan(0);
  expect(after.users).toBeGreaterThanOrEqual(before.users);
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

  {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO saved_offers (user_id, offer_id, created_at) VALUES (?, 'offer-from-beyond', datetime('now'))").run(userId);
    db.close();
  }

  const orphanSql = "SELECT COUNT(*) n FROM saved_offers WHERE offer_id = 'offer-from-beyond'";
  expect(countFor(orphanSql)).toBe(1);

  const init = runInit();
  expect(init.status, init.stdout + init.stderr).toBe(0);

  expect(countFor(orphanSql)).toBe(0);
  expect(countFor('SELECT COUNT(*) n FROM saved_offers WHERE user_id = ?', userId)).toBe(1);
  expect(countFor('SELECT COUNT(*) n FROM users WHERE email = ?', email)).toBe(1);

  const after = snapshot();
  expect(after.fkViolations).toBe(0);
});

test('3. Fresh database initialization creates demo account (idempotent)', async () => {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.prepare("DELETE FROM users WHERE email = ?").run(DEMO_EMAIL);
  db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)").run(DEMO_EMAIL);
  db.close();

  const init1 = runInit();
  expect(init1.status, init1.stdout + init1.stderr).toBe(0);
  expect(countDemoUsers()).toBe(1);
  const demo1 = getDemoUser();
  expect(demo1).toBeTruthy();
  expect(demo1.email).toBe(DEMO_EMAIL);
  expect(typeof demo1.password_hash).toBe('string');
  expect(demo1.password_hash.length).toBeGreaterThan(10);

  const init2 = runInit();
  expect(init2.status, init2.stdout + init2.stderr).toBe(0);
  expect(countDemoUsers()).toBe(1);
  const demo2 = getDemoUser();
  expect(demo2.id).toBe(demo1.id);
  expect(demo2.password_hash).toBe(demo1.password_hash);
});

test('4. Demo login works with documented credentials after init', async ({ request }) => {
  const init = runInit();
  expect(init.status, init.stdout + init.stderr).toBe(0);
  expect(countDemoUsers()).toBe(1);

  const login = await request.post('/api/auth/login', { data: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
  expect(login.status()).toBe(200);
  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  const body = await me.json();
  expect(body.data.user.email).toBe(DEMO_EMAIL);
});

test('5. Initialization does not overwrite existing account password', async ({ request }) => {
  const email = `dbinitpw-${Date.now()}@example.com`;
  const originalPass = 'OriginalPass123';
  const reg = await request.post('/api/auth/register', { data: { email, password: originalPass } });
  expect(reg.status()).toBe(201);

  const db = new Database(DB_PATH, { readonly: true });
  const beforeHash = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email).password_hash;
  db.close();

  const init = runInit();
  expect(init.status, init.stdout + init.stderr).toBe(0);

  const db2 = new Database(DB_PATH, { readonly: true });
  const afterHash = db2.prepare('SELECT password_hash FROM users WHERE email = ?').get(email).password_hash;
  db2.close();
  expect(afterHash).toBe(beforeHash);

  const bad = await request.post('/api/auth/login', { data: { email, password: 'WrongPass123' } });
  expect([401, 400].includes(bad.status())).toBeTruthy();
  const good = await request.post('/api/auth/login', { data: { email, password: originalPass } });
  expect(good.status()).toBe(200);
});

test('6. Demo account can be overridden via env vars (non-destructive to other users)', async () => {
  const customEmail = 'custom-demo@loanfinder.test';
  const customPass = 'CustomDemo123';
  const db = new Database(DB_PATH);
  db.prepare("DELETE FROM users WHERE email = ?").run(customEmail);
  const beforeCount = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  db.close();

  const init = runInit({ DEMO_EMAIL: customEmail, DEMO_PASSWORD: customPass });
  expect(init.status, init.stdout + init.stderr).toBe(0);
  expect(countFor('SELECT COUNT(*) n FROM users WHERE email = ?', customEmail)).toBe(1);

  const db2 = new Database(DB_PATH, { readonly: true });
  const afterCount = db2.prepare('SELECT COUNT(*) n FROM users').get().n;
  const h = db2.prepare('SELECT password_hash FROM users WHERE email = ?').get(customEmail).password_hash;
  db2.close();
  expect(typeof h).toBe('string');
  expect(h.length).toBeGreaterThan(10);
  expect(afterCount).toBeGreaterThanOrEqual(beforeCount);

  const initRestore = runInit();
  expect(initRestore.status, initRestore.stdout + initRestore.stderr).toBe(0);
  expect(countDemoUsers()).toBe(1);

  const dbClean = new Database(DB_PATH);
  dbClean.prepare("DELETE FROM users WHERE email = ?").run(customEmail);
  dbClean.close();
});
