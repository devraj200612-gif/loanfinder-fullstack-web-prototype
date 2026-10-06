// Phase 2C REST API tests.
//
// Spawns the real server once (node server.js on a random port), then exercises
// the read-only data API against the actual Phase 2B SQLite database. Includes
// the required checklist (health, banks, offers + loan_type filter, single
// offers, branches + city filter, single branches, hidden charges, unknown
// routes) plus a database-parity test that compares API output field-by-field
// with the seeded database (better-sqlite3), and a read-only assertion.
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const DB_PATH = path.join(ROOT, 'data', 'loanfinder.sqlite');

let base = '';
let child;

test.beforeAll(async () => {
  child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start: ' + stdout + ' ' + stderr)), 20000);
    child.stdout.on('data', () => {
      const m = stdout.match(/listening on port (\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
  });
  base = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  if (child && child.exitCode === null && child.pid) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await Promise.race([exited, new Promise(r => setTimeout(r, 10000))]);
  }
});

async function getJson(item, p) {
  const r = await fetch(base + p);
  return { status: r.status, json: await r.json() };
}

test('1. /api/health is 200', async () => {
  const { status, json } = await getJson({}, '/api/health');
  expect(status).toBe(200);
  expect(json).toEqual({ status: 'ok', service: 'LoanFinder API' });
});

test('2. /api/banks returns the 5 seeded banks', async () => {
  const { status, json } = await getJson({}, '/api/banks');
  expect(status).toBe(200);
  expect(json.data).toHaveLength(5);
  for (const bank of json.data) {
    expect(typeof bank.id).toBe('number');
    expect(typeof bank.name).toBe('string');
    expect(typeof bank.short_code).toBe('string');
  }
  const names = json.data.map(b => b.name);
  expect(names).toContain('State Bank');
  expect(names).toContain('Kotak Mahindra');
});

test('3. /api/loan-offers returns 7 offers; loan_type filters home=5, personal=2, unknown=empty', async () => {
  const all = await getJson({}, '/api/loan-offers');
  expect(all.status).toBe(200);
  expect(all.json.data).toHaveLength(7);
  for (const offer of all.json.data) {
    expect(offer.bank).toBeDefined();
    expect(typeof offer.bank.id).toBe('number');
  }

  const home = await getJson({}, '/api/loan-offers?loan_type=home');
  expect(home.status).toBe(200);
  expect(home.json.data).toHaveLength(5);
  expect(home.json.data.every(o => o.loan_type_id === 'home')).toBe(true);

  const personal = await getJson({}, '/api/loan-offers?loan_type=personal');
  expect(personal.status).toBe(200);
  expect(personal.json.data).toHaveLength(2);
  expect(personal.json.data.every(o => o.loan_type_id === 'personal')).toBe(true);

  const unknown = await getJson({}, '/api/loan-offers?loan_type=nope');
  expect(unknown.status).toBe(200);
  expect(unknown.json.data).toEqual([]);
});

test('4. /api/loan-offers/:id returns a single offer (200) and 404 for missing', async () => {
  const ok = await getJson({}, '/api/loan-offers/sbi-home');
  expect(ok.status).toBe(200);
  expect(ok.json.data.id).toBe('sbi-home');
  expect(ok.json.data.bank.name).toBe('State Bank');
  expect(ok.json.data.interest_rate).toBe(7.85);

  const missing = await getJson({}, '/api/loan-offers/nonexistent');
  expect(missing.status).toBe(404);
  expect(typeof missing.json.error).toBe('string');
});

test('5. /api/branches returns 33; city filters match the seeded totals', async () => {
  const all = await getJson({}, '/api/branches');
  expect(all.status).toBe(200);
  expect(all.json.data).toHaveLength(33);
  const keys = new Set(Object.keys(all.json.data[0]));
  for (const k of ['id', 'bank', 'city', 'branch_name', 'address', 'hours', 'phone', 'latitude', 'longitude', 'geo_precision', 'ifsc', 'source_url', 'source_name', 'verification_status']) {
    expect(keys.has(k)).toBe(true);
  }

  const expected = { Mumbai: 9, Delhi: 7, Bengaluru: 2, Hyderabad: 7, Pune: 8 };
  for (const [city, count] of Object.entries(expected)) {
    const r = await getJson({}, `/api/branches?city=${encodeURIComponent(city)}`);
    expect(r.status).toBe(200);
    expect(r.json.data).toHaveLength(count);
    expect(r.json.data.every(b => b.city === city)).toBe(true);
  }

  const unknown = await getJson({}, '/api/branches?city=Nowhere');
  expect(unknown.status).toBe(200);
  expect(unknown.json.data).toEqual([]);
});

test('6. /api/branches/:id returns a single branch (200) and 404 for missing', async () => {
  const hyd = await getJson({}, '/api/branches/hyderabad-state-bank-hyderabad-main-branch-koti');
  expect(hyd.status).toBe(200);
  expect(hyd.json.data.ifsc).toBe('SBIN0000847');
  expect(hyd.json.data.verification_status).toBe('verified');
  expect(hyd.json.data.latitude).toBe(17.443317);

  const missing = await getJson({}, '/api/branches/nonexistent');
  expect(missing.status).toBe(404);
  expect(typeof missing.json.error).toBe('string');
});

test('7. /api/loan-offers/:id/hidden-charges returns the fine-print data; 404 for unknown offer', async () => {
  const ok = await getJson({}, '/api/loan-offers/sbi-home/hidden-charges');
  expect(ok.status).toBe(200);
  expect(ok.json.data.length).toBeGreaterThan(0);
  expect(ok.json.data.every(c => c.offer_id === 'sbi-home')).toBe(true);

  const missing = await getJson({}, '/api/loan-offers/nonexistent/hidden-charges');
  expect(missing.status).toBe(404);
  expect(typeof missing.json.error).toBe('string');
});

test('8. unknown API route is a clean JSON 404', async () => {
  const { status, json } = await getJson({}, '/api/definitely-not-a-route');
  expect(status).toBe(404);
  expect(json.error).toBeDefined();
});

test('9. API responses match the seeded SQLite database (database parity)', async () => {
  const db = new Database(DB_PATH, { readonly: true });

  // Banks.
  const apiBanks = (await getJson({}, '/api/banks')).json.data;
  const dbBanks = db.prepare('SELECT id, name, short_code FROM banks ORDER BY id').all();
  expect(apiBanks).toEqual(dbBanks);

  // Offers: numeric contract fields must be byte-identical to the database.
  const apiOffers = (await getJson({}, '/api/loan-offers')).json.data;
  expect(apiOffers).toHaveLength(7);
  const homeCount = apiOffers.filter(o => o.loan_type === 'Home Loan').length;
  const personalCount = apiOffers.filter(o => o.loan_type === 'Personal Loan').length;
  expect(homeCount).toBe(5);
  expect(personalCount).toBe(2);
  for (const offer of apiOffers) {
    const row = db.prepare('SELECT * FROM loan_offers WHERE id = ?').get(offer.id);
    expect(offer.interest_rate).toBe(row.interest_rate);
    expect(offer.processing_fee_percent).toBe(row.processing_fee_percent);
    expect(offer.processing_fee_max).toBe(row.processing_fee_max);
    expect(offer.max_amount).toBe(row.max_amount);
    expect(offer.max_tenure).toBe(row.max_tenure);
    expect(offer.min_credit_score).toBe(row.min_credit_score);
    expect(offer.min_monthly_income).toBe(row.min_monthly_income);
    expect(offer.employment_types).toEqual(JSON.parse(row.employment_types));
    expect(offer.verification_status).toBe(row.verification_status);
  }

  // Branches: coordinates, IFSC, verification status and provenance are preserved.
  const apiBranches = (await getJson({}, '/api/branches')).json.data;
  expect(apiBranches).toHaveLength(33);
  for (const branch of apiBranches) {
    const row = db.prepare('SELECT * FROM branches WHERE id = ?').get(branch.id);
    expect(branch.latitude).toBe(row.latitude);
    expect(branch.longitude).toBe(row.longitude);
    expect(branch.geo_precision).toBe(row.geo_precision);
    expect(branch.ifsc).toBe(row.ifsc);
    expect(branch.verification_status).toBe(row.verification_status);
    expect(branch.source_url).toBe(row.source_url);
    expect(branch.source_name).toBe(row.source_name);
  }
  const verified = apiBranches.filter(b => b.verification_status === 'verified').length;
  const withIfsc = apiBranches.filter(b => b.ifsc).length;
  expect(verified).toBe(15);
  expect(withIfsc).toBe(15);

  // Hidden charges: the full seeded 35 records are reachable through the API.
  let apiChargeRows = 0;
  for (const offer of apiOffers) {
    const r = await getJson({}, `/api/loan-offers/${offer.id}/hidden-charges`);
    expect(r.status).toBe(200);
    apiChargeRows += r.json.data.length;
  }
  const dbChargeRows = db.prepare('SELECT COUNT(*) n FROM hidden_charges').get().n;
  expect(apiChargeRows).toBe(35);
  expect(apiChargeRows).toBe(dbChargeRows);

  db.close();
});

test('10. the API is read-only: POST/PUT/PATCH/DELETE are not accepted', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await fetch(base + '/api/loan-offers', { method });
    expect(r.status).toBe(404);
  }
  const missing = await getJson({}, '/api/health');
  expect(missing.status).toBe(200);
});