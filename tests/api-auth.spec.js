// Phase 2G API hardening + auth tests (server-level, no browser).
//
// Spawns its own server (like api.spec.js) so the auth rate limiter runs with
// a generous limit for this file's credential POSTs; a dedicated low-limit
// instance is spawned inside the 429 test so the assertion is deterministic.
//
// Covers the Phase 2F audit gaps: auth failure status codes (400/401/409),
// anonymous access to saved offers, cross-user isolation, duplicate saves,
// security headers and honest 4xx handling for malformed/oversized bodies.
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');

let base = '';
let child;

async function spawnServer(env = {}) {
  const proc = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start: ' + stdout + ' ' + stderr)), 20000);
    proc.stdout.on('data', () => {
      const m = stdout.match(/listening on port (\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
  });
  return { proc, base: `http://127.0.0.1:${port}` };
}

async function stopServer(proc) {
  if (proc && proc.exitCode === null && proc.pid) {
    const exited = new Promise((resolve) => proc.once('exit', resolve));
    proc.kill('SIGTERM');
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10000))]);
  }
}

function postJson(url, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

function cookieOf(res) {
  const raw = res.headers.get('set-cookie') || '';
  const m = raw.match(/lf_session=([^;]+)/);
  return m ? `lf_session=${m[1]}` : '';
}

test.beforeAll(async () => {
  ({ proc: child, base } = await spawnServer({ AUTH_RATE_LIMIT_MAX: '1000' }));
});

test.afterAll(async () => {
  await stopServer(child);
});

test('1. security headers are set on API responses', async () => {
  const r = await fetch(base + '/api/health');
  expect(r.status).toBe(200);
  expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  expect(r.headers.get('x-frame-options')).toBe('DENY');
  expect(r.headers.get('referrer-policy')).toBe('no-referrer');
  // HSTS must only be advertised when NODE_ENV=production.
  expect(r.headers.get('strict-transport-security')).toBeNull();
});

test('2. malformed JSON body returns 400 Invalid JSON body', async () => {
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": ',
  });
  expect(r.status).toBe(400);
  const j = await r.json();
  expect(j.error).toBe('Invalid JSON body');
});

test('3. oversized JSON body returns 413 Payload too large', async () => {
  const big = JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200000) });
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: big,
  });
  expect(r.status).toBe(413);
  const j = await r.json();
  expect(j.error).toBe('Payload too large');
});

test('4. login with unknown user or wrong password returns 401 Invalid credentials', async () => {
  const r = await postJson(base + '/api/auth/login', { email: 'nobody@example.com', password: 'wrongpass123' });
  expect(r.status).toBe(401);
  expect((await r.json()).error).toBe('Invalid credentials');
});

test('5. register validation returns 400 for bad email or short password', async () => {
  const badEmail = await postJson(base + '/api/auth/register', { email: 'not-an-email', password: 'longenough1' });
  expect(badEmail.status).toBe(400);
  expect((await badEmail.json()).error).toBe('Invalid email');

  const noPassword = await postJson(base + '/api/auth/register', { email: 'ok@example.com' });
  expect(noPassword.status).toBe(400);
  expect((await noPassword.json()).error).toBe('Password required');

  const shortPassword = await postJson(base + '/api/auth/register', { email: 'ok@example.com', password: 'short' });
  expect(shortPassword.status).toBe(400);
  expect((await shortPassword.json()).error).toBe('Password must be at least 8 characters');
});

test('6. duplicate register returns 409', async () => {
  const email = `apiauth-${Date.now()}@example.com`;
  const first = await postJson(base + '/api/auth/register', { email, password: 'ApiAuthTest1' });
  expect(first.status).toBe(201);

  const dup = await postJson(base + '/api/auth/register', { email, password: 'ApiAuthTest1' });
  expect(dup.status).toBe(409);
  expect((await dup.json()).error).toBe('Email already registered');
});

test('7. successful login sets an httpOnly session cookie', async () => {
  const email = `apiauth-login-${Date.now()}@example.com`;
  await postJson(base + '/api/auth/register', { email, password: 'ApiAuthTest1' });

  const r = await postJson(base + '/api/auth/login', { email, password: 'ApiAuthTest1' });
  expect(r.status).toBe(200);
  const setCookie = r.headers.get('set-cookie') || '';
  expect(setCookie).toContain('lf_session=');
  expect(setCookie.toLowerCase()).toContain('httponly');
  expect(setCookie).toContain('SameSite=Lax');
  expect((await r.json()).data.user.email).toBe(email);
});

test('8. anonymous requests to saved offers return 401', async () => {
  const get = await fetch(base + '/api/saved-offers');
  expect(get.status).toBe(401);
  expect((await get.json()).error).toBe('Authentication required');

  const post = await postJson(base + '/api/saved-offers', { offer_id: 'some-offer' });
  expect(post.status).toBe(401);

  const me = await fetch(base + '/api/auth/me');
  expect(me.status).toBe(401);
});

test('9. saved-offer validation: 400 bad id, 404 unknown offer, 409 duplicate, 400/404 delete', async ({ request }) => {
  const email = `apiauth-saved-${Date.now()}@example.com`;
  const reg = await postJson(base + '/api/auth/register', { email, password: 'ApiAuthTest1' });
  expect(reg.status).toBe(201);
  const cookie = cookieOf(reg);
  expect(cookie).not.toBe('');

  const notString = await postJson(base + '/api/saved-offers', { offer_id: 123 }, cookie);
  expect(notString.status).toBe(400);
  expect((await notString.json()).error).toBe('offer_id required');

  const missing = await postJson(base + '/api/saved-offers', { offer_id: 'no-such-offer' }, cookie);
  expect(missing.status).toBe(404);
  expect((await missing.json()).error).toBe('Loan offer not found');

  const offers = await request.get('/api/loan-offers');
  const offerId = (await offers.json()).data[0].id;

  const saved = await postJson(base + '/api/saved-offers', { offer_id: offerId }, cookie);
  expect(saved.status).toBe(201);
  const savedRow = await saved.json();

  const dup = await postJson(base + '/api/saved-offers', { offer_id: offerId }, cookie);
  expect(dup.status).toBe(409);
  expect((await dup.json()).error).toBe('Offer already saved');

  const badDelete = await fetch(base + '/api/saved-offers/abc', { method: 'DELETE', headers: { Cookie: cookie } });
  expect(badDelete.status).toBe(400);
  expect((await badDelete.json()).error).toBe('Invalid saved offer id');

  const unknownDelete = await fetch(base + '/api/saved-offers/999999', { method: 'DELETE', headers: { Cookie: cookie } });
  expect(unknownDelete.status).toBe(404);

  // cleanup: the row must be deletable by its owner
  const ok = await fetch(base + `/api/saved-offers/${savedRow.data.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  expect(ok.status).toBe(200);
});

test('10. cross-user isolation: users cannot see or delete each other\'s saved offers', async ({ request }) => {
  const stamp = Date.now();
  const emailA = `apiauth-a-${stamp}@example.com`;
  const emailB = `apiauth-b-${stamp}@example.com`;

  const regA = await postJson(base + '/api/auth/register', { email: emailA, password: 'ApiAuthTest1' });
  const cookieA = cookieOf(regA);
  const regB = await postJson(base + '/api/auth/register', { email: emailB, password: 'ApiAuthTest1' });
  const cookieB = cookieOf(regB);
  expect(cookieA).not.toBe('');
  expect(cookieB).not.toBe('');

  const offers = await request.get('/api/loan-offers');
  const offerId = (await offers.json()).data[0].id;
  const saved = await postJson(base + '/api/saved-offers', { offer_id: offerId }, cookieA);
  expect(saved.status).toBe(201);
  const rowId = (await saved.json()).data.id;

  // B sees none of A's rows
  const listB = await fetch(base + '/api/saved-offers', { headers: { Cookie: cookieB } });
  expect(listB.status).toBe(200);
  const rowsB = (await listB.json()).data;
  expect(Array.isArray(rowsB)).toBe(true);
  expect(rowsB.find((r) => r.id === rowId)).toBeUndefined();

  // B cannot delete A's row (404, not a leak)
  const delB = await fetch(base + `/api/saved-offers/${rowId}`, { method: 'DELETE', headers: { Cookie: cookieB } });
  expect(delB.status).toBe(404);

  // A's row is untouched
  const listA = await fetch(base + '/api/saved-offers', { headers: { Cookie: cookieA } });
  const rowsA = (await listA.json()).data;
  expect(rowsA.find((r) => r.id === rowId)).toBeDefined();

  // cleanup A's row
  await fetch(base + `/api/saved-offers/${rowId}`, { method: 'DELETE', headers: { Cookie: cookieA } });
});

test('11. auth endpoints return 429 with Retry-After after the rate limit', async () => {
  const { proc, base: limited } = await spawnServer({ AUTH_RATE_LIMIT_MAX: '3' });
  try {
    const statuses = [];
    let limitedBody = null;
    let retryAfter = null;
    for (let i = 0; i < 6; i++) {
      const r = await postJson(limited + '/api/auth/login', { email: 'probe@example.com', password: 'badpass123' });
      statuses.push(r.status);
      if (r.status === 429 && !limitedBody) {
        limitedBody = await r.json();
        retryAfter = r.headers.get('retry-after');
      }
    }
    // First three attempts reach the handler (401); the rest are throttled.
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses).toContain(429);
    expect(limitedBody.status).toBe(429);
    expect(limitedBody.error).toMatch(/too many requests/i);
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // GETs are never rate limited.
    const health = await fetch(limited + '/api/health');
    expect(health.status).toBe(200);
    const me = await fetch(limited + '/api/auth/me');
    expect(me.status).toBe(401);
  } finally {
    await stopServer(proc);
  }
});
