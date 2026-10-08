// Phase 2E: proof that the browser UI is wired to the authenticated backend.
//
// Each test drives the REAL UI (forms, save buttons, logout) and then verifies
// the result at two independent levels:
//   1. the wire  - the exact API request the click produced, and
//   2. the disk  - a direct better-sqlite3 read of data/loanfinder.sqlite.
//
// Covered flow (UI register -> save -> reload -> logout -> login -> delete),
// plus the guest rules: browse and match freely, but never create a saved
// offer, and never be shown as a fake signed-in user.
const { test, expect } = require('@playwright/test');
const path = require('path');
const Database = require('better-sqlite3');
const { APP_URL, collectErrors, navigate, findMatchingLoans } = require('./helpers');

const DB_PATH = path.join(__dirname, '..', 'data', 'loanfinder.sqlite');
const LOCAL_DB_KEY = 'loanfinder.db.v1';

// Reads an account's saved-offer rows straight from SQLite, bypassing both the
// API and the UI, so "persisted" always means the database itself.
function savedRowsFor(email) {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return db.prepare(`
      SELECT so.id, so.offer_id, so.created_at
      FROM saved_offers so
      JOIN users u ON u.id = so.user_id
      WHERE u.email = ?
      ORDER BY so.id
    `).all(email.trim().toLowerCase());
  } finally {
    db.close();
  }
}

// Records every API call the page makes so a test can assert that a UI action
// hit the right endpoint - and that forbidden endpoints were never called.
function trackApi(page) {
  const log = [];
  page.on('request', r => {
    const url = r.url();
    const i = url.indexOf('/api/');
    if (i === -1) return;
    log.push({ method: r.method(), path: url.slice(i) });
  });
  return log;
}
const saw = (log, method, re) => log.some(e => e.method === method && re.test(e.path));

// The recommendation card's bookmark button for a given offer (the onclick
// carries the offer id; the same card may be rendered into several containers).
const saveButtonFor = (page, offerId) =>
  page.locator(`button[title="Save Offer"][onclick*="toggleSaveOffer('${offerId}')"]`).first();

test.describe('Phase 2E: the UI drives the real auth + saved-offer APIs', () => {
  test('register, save, reload, logout, login and delete all go through the API and the database', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    const net = trackApi(page);
    const email = `phase2e.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
    const password = 'Phase2ePass1';
    const localPart = email.split('@')[0];

    // ---- 1. Register through the real sign-up form. --------------------
    await page.goto(APP_URL);
    await page.waitForSelector('button:has-text("Start Comparing Free")');
    await page.click('button:has-text("Start Comparing Free")');
    await expect(page.locator('#auth-page')).toBeVisible();
    await page.click('#auth-tab-signup');
    await page.fill('#signup-first', 'Phase');
    await page.fill('#signup-last', 'Tester');
    await page.fill('#signup-email', email);
    await page.fill('#signup-password', password);
    await page.locator('#auth-signup-form input[type="checkbox"]').check();
    const registered = page.waitForResponse(r =>
      r.url().includes('/api/auth/register') && r.request().method() === 'POST');
    await page.locator('#auth-signup-form button[type="submit"]').click();
    expect((await registered).status()).toBe(201);

    // ---- 2. The dashboard shows THIS account's identity, not a fake one. ----
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#sidebar-user-name')).toHaveText(localPart);
    await expect(page.locator('#sidebar-user-email')).toHaveText(email);
    await expect(page.locator('#topbar-user-name')).toHaveText(localPart);
    await expect(page.locator('#profile-heading')).toHaveText(localPart);
    await expect(page.locator('#profile-email')).toHaveValue(email);
    await expect(page.locator('#sidebar-user-name')).not.toHaveText('Alex Johnson');
    await expect(page.locator('#sidebar-user-email')).not.toHaveText('alex.j@example.com');
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).data.user.email).toBe(email);
    const cookies = await page.context().cookies();
    expect(cookies.some(c => c.name === 'lf_session'), 'session cookie set on register').toBe(true);

    // ---- 3. Saving from a recommendation card -> POST /api/saved-offers. ----
    await findMatchingLoans(page);
    const saveBtn = saveButtonFor(page, 'sbi-home');
    await expect(saveBtn).toBeVisible();
    const saved = page.waitForResponse(r =>
      r.url().includes('/api/saved-offers') && r.request().method() === 'POST');
    await saveBtn.click();
    const savedRes = await saved;
    expect(savedRes.status()).toBe(201);
    expect((await savedRes.json()).data.offer_id).toBe('sbi-home');
    // ...and the row exists in SQLite, tied to this account (not to a browser
    // profile, not to the prototype's demo user).
    expect(savedRowsFor(email).map(r => r.offer_id)).toContain('sbi-home');
    // The Saved view renders it.
    await navigate(page, 'saved');
    await expect(page.locator('#saved-cards-container')).toContainText('State Bank');

    // ---- 4. Reload: the session and the saved offer are restored from the API. ----
    const bootMe = page.waitForResponse(r =>
      r.url().includes('/api/auth/me') && r.request().method() === 'GET');
    const bootSaved = page.waitForResponse(r =>
      r.url().endsWith('/api/saved-offers') && r.request().method() === 'GET');
    await page.reload();
    await expect(page.locator('#boot-overlay')).toHaveClass(/boot-hidden/);
    expect((await bootMe).status()).toBe(200);
    expect((await bootSaved).status()).toBe(200);
    // Signed-in visitor walks straight past the sign-in screen.
    await page.click('button:has-text("Start Comparing Free")');
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#auth-page')).toBeHidden();
    await expect(page.locator('#sidebar-user-name')).toHaveText(localPart);
    await navigate(page, 'saved');
    await expect(page.locator('#saved-cards-container')).toContainText('State Bank');
    expect(savedRowsFor(email).map(r => r.offer_id)).toContain('sbi-home');

    // ---- 5. Logout ends the session on the server. ----------------------
    const logout = page.waitForResponse(r =>
      r.url().includes('/api/auth/logout') && r.request().method() === 'POST');
    await page.click('#logout-btn');
    expect((await logout).status()).toBe(200);
    await expect(page.locator('#auth-page')).toBeVisible();
    await expect(page.locator('#sidebar-user-name')).toHaveText('Guest');
    await expect(page.locator('#sidebar-user-email')).toHaveText('Not signed in');
    expect((await page.context().cookies()).some(c => c.name === 'lf_session')).toBe(false);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    // Logging out does not delete the account's saved offers.
    expect(savedRowsFor(email).map(r => r.offer_id)).toContain('sbi-home');

    // ---- 6. Logging back in restores the account's saved offer. ---------
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    const login = page.waitForResponse(r =>
      r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await page.locator('#auth-login-form button').last().click();
    expect((await login).status()).toBe(200);
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#sidebar-user-name')).toHaveText(localPart);
    await navigate(page, 'saved');
    await expect(page.locator('#saved-cards-container')).toContainText('State Bank');

    // ---- 7. Delete from the Saved view -> DELETE /api/saved-offers/:id. --
    const row = savedRowsFor(email).find(r => r.offer_id === 'sbi-home');
    expect(row, 'the saved row has a database id to delete').toBeTruthy();
    const del = page.waitForResponse(r =>
      r.request().method() === 'DELETE' && r.url().includes('/api/saved-offers/' + row.id));
    await page.locator('#saved-cards-container button:has-text("Remove")').first().click();
    expect((await del).status()).toBe(200);
    await expect(page.locator('#saved-cards-container')).toContainText('No Saved Bank Offers');
    expect(savedRowsFor(email)).toEqual([]);

    // ---- 8. Nothing about saved offers is mirrored into localStorage. ---
    const local = await page.evaluate(key =>
      JSON.parse(localStorage.getItem(key) || '{}'), LOCAL_DB_KEY);
    expect(local.savedOffers || []).toEqual([]);

    // ---- 9. The whole flow really went over the wire. -------------------
    expect(saw(net, 'POST', /\/api\/auth\/register$/), 'register hit the API').toBe(true);
    expect(saw(net, 'POST', /\/api\/auth\/login$/), 'login hit the API').toBe(true);
    expect(saw(net, 'POST', /\/api\/auth\/logout$/), 'logout hit the API').toBe(true);
    expect(saw(net, 'GET', /\/api\/auth\/me$/), 'session was probed at boot').toBe(true);
    expect(saw(net, 'POST', /\/api\/saved-offers$/), 'save hit the API').toBe(true);
    expect(saw(net, 'DELETE', /\/api\/saved-offers\/\d+$/), 'delete hit the API').toBe(true);

    expect(errors, 'no console or page errors across the whole flow').toEqual([]);
  });

  test('a guest can browse, match and open branches but never creates a saved offer', async ({ page }) => {
    const errors = collectErrors(page);
    const net = trackApi(page);

    // Enter through the honest guest path on the sign-in screen.
    await page.goto(APP_URL);
    await page.waitForSelector('button:has-text("Start Comparing Free")');
    await page.click('button:has-text("Start Comparing Free")');
    await expect(page.locator('#auth-page')).toBeVisible();
    await page.click('#auth-guest-btn');
    await expect(page.locator('#view-dashboard')).toBeVisible();

    // Every identity surface says "Guest" - nobody is pretending to be signed in.
    await expect(page.locator('#sidebar-user-name')).toHaveText('Guest');
    await expect(page.locator('#sidebar-user-email')).toHaveText('Not signed in');
    await expect(page.locator('#topbar-user-name')).toHaveText('Guest');
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);

    // The public matcher still works.
    await findMatchingLoans(page);
    const text = await page.locator('#hero-best-offer-container').innerText();
    expect(text).toContain('State Bank');
    expect(text).toContain('100% Match');

    // A save attempt asks the guest to sign in: no request, no row, no copy.
    const saveBtn = saveButtonFor(page, 'sbi-home');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(page.locator('#toast-host')).toContainText('Sign in to save offers');
    expect(saw(net, 'POST', /\/api\/saved-offers/), 'guest never POSTs a saved offer').toBe(false);
    const local = await page.evaluate(key =>
      JSON.parse(localStorage.getItem(key) || '{}'), LOCAL_DB_KEY);
    expect(local.savedOffers || []).toEqual([]);

    // The Saved view explains the rules instead of showing fake saved data.
    await navigate(page, 'saved');
    await expect(page.locator('#saved-cards-container')).toContainText('Sign In To Save Offers');

    // The rest of the public app (branch finder) works for a guest too.
    await navigate(page, 'branches');
    await expect(page.locator('#branch-cards-container .branch-card').first()).toBeVisible();

    expect(errors, 'no console or page errors while browsing as a guest').toEqual([]);
  });
});
