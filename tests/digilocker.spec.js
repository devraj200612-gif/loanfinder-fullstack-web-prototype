// DigiLocker is a SIMULATION: no service is contacted and no OTP is sent. The
// tests assert that the gating, the sample-document labelling and the import
// de-duplication work, and that the UI never claims a real fetch happened.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

async function openDocuments(page) {
  await launchApp(page);
  await navigate(page, 'documents');
  await expect(page.locator('#doc-checklist-container')).toBeVisible();
}

async function connect(page) {
  await page.click('#digilocker-connect-btn');
  await page.waitForSelector('#digilocker-aadhaar', { state: 'visible', timeout: 15_000 });
}

test.describe('DigiLocker simulation', () => {
  test('connect opens the flow and asks for an Aadhaar number', async ({ page }) => {
    const errors = collectErrors(page);
    await openDocuments(page);
    await connect(page);

    await expect(page.locator('#digilocker-aadhaar')).toBeVisible();
    await expect(page.locator('#digilocker-send-otp-btn')).toBeVisible();

    // it states up front that no OTP is actually sent
    const modal = await page.locator('#digilocker-aadhaar').locator('xpath=ancestor::*[contains(@class,"modal") or @role="dialog"]').innerText().catch(() => '');
    const body = await page.locator('body').innerText();
    const text = (modal + ' ' + body).toLowerCase();
    expect(text).toMatch(/simulat|demo|sample|no otp|not (actually )?sent/i);

    expect(errors).toEqual([]);
  });

  test('the OTP step is gated until a valid Aadhaar number is entered', async ({ page }) => {
    await openDocuments(page);
    await connect(page);

    await page.fill('#digilocker-aadhaar', '1234');          // too short
    // Send OTP is disabled until 12 digits are entered (app.formatAadhaar), so
    // the flow cannot advance. Assert the gate rather than clicking a disabled
    // button, which would just stall until the test timeout.
    await expect(page.locator('#digilocker-send-otp-btn')).toBeDisabled();
    await expect(page.locator('#digilocker-otp-group')).toBeHidden();

    await page.fill('#digilocker-aadhaar', '123456789012');  // 12 digits
    await expect(page.locator('#digilocker-send-otp-btn')).toBeEnabled();
    await page.click('#digilocker-send-otp-btn');
    await expect(page.locator('#digilocker-otp-group')).toBeVisible();
    await expect(page.locator('#digilocker-verify-btn')).toBeVisible();
  });

  test('any six-digit code verifies because no OTP is sent', async ({ page }) => {
    await openDocuments(page);
    await connect(page);
    await page.fill('#digilocker-aadhaar', '123456789012');
    await page.click('#digilocker-send-otp-btn');
    await page.waitForTimeout(800);

    // Scope to the OTP group: a bare input[inputmode="numeric"] selector also
    // matches #digilocker-aadhaar, which is hidden once the OTP step is shown.
    const inputs = page.locator('#digilocker-otp-group .otp-input');
    const n = await inputs.count();
    expect(n).toBe(6);
    for (let i = 0; i < n; i++) await inputs.nth(i).fill('1');

    await page.click('#digilocker-verify-btn');
    await page.waitForTimeout(1500);

    // sample documents become visible
    await expect(page.locator('#digilocker-import-btn')).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/sample|simulat|demo/);
  });

  test('sample documents are labelled as samples', async ({ page }) => {
    await openDocuments(page);
    await connect(page);
    await page.fill('#digilocker-aadhaar', '123456789012');
    await page.click('#digilocker-send-otp-btn');
    await page.waitForTimeout(700);
    // Scope to the OTP group: a bare input[inputmode="numeric"] selector also
    // matches #digilocker-aadhaar, which is hidden once the OTP step is shown.
    const inputs = page.locator('#digilocker-otp-group .otp-input');
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill('1');
    await page.click('#digilocker-verify-btn');

    // the document rows are clickable divs, and the list only renders once
    // the (simulated) fetch finishes - so wait for the select step
    const items = page.locator('#digilocker-doc-list .digilocker-doc-item');
    await expect(items.first()).toBeVisible({ timeout: 20_000 });

    const body = await page.locator('body').innerText();
    // nothing is presented as a real DigiLocker pull
    expect(body).toMatch(/sample|simulat|demo/i);

    // "sample" labelling is on the post-import confirmation
    const n = await items.count();
    for (let i = 0; i < n; i++) await items.nth(i).click();
    await expect(page.locator('#digilocker-import-btn')).toBeEnabled();
    await page.click('#digilocker-import-btn');
    await page.waitForTimeout(1200);

    const success = await page.locator('body').innerText();
    expect(success).toMatch(/sample/i);
  });

  test('importing documents does not create duplicates', async ({ page }) => {
    await openDocuments(page);
    await connect(page);
    await page.fill('#digilocker-aadhaar', '123456789012');
    await page.click('#digilocker-send-otp-btn');
    await page.waitForTimeout(700);
    // Scope to the OTP group: a bare input[inputmode="numeric"] selector also
    // matches #digilocker-aadhaar, which is hidden once the OTP step is shown.
    const inputs = page.locator('#digilocker-otp-group .otp-input');
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill('1');
    await page.click('#digilocker-verify-btn');

    const checklistBefore = await page.locator('#doc-checklist-container').innerText();

    // select everything offered, then import. The simulated fetch takes several
    // seconds, so wait for the select step rather than sleeping a fixed amount.
    const items = page.locator('#digilocker-doc-list .digilocker-doc-item');
    await expect(items.first()).toBeVisible({ timeout: 20_000 });
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await items.nth(i).click();
    await expect(page.locator('#digilocker-import-btn')).toBeEnabled();
    await page.click('#digilocker-import-btn');
    await page.waitForTimeout(1500);

    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').digilocker || null);
    const checklistAfter = await page.locator('#doc-checklist-container').innerText();

    // no duplicate ids were recorded
    const ids = (after && after.docs ? after.docs : []).map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(checklistAfter.length).toBeGreaterThan(0);
    expect(checklistBefore.length).toBeGreaterThan(0);

    // renderDigiLockerDocList filters the catalogue through the imported ids, so
    // re-rendering must not offer the documents we just imported a second time.
    await page.evaluate(() => window.app.renderDigiLockerDocList());

    const items2 = page.locator('#digilocker-doc-list .digilocker-doc-item');
    await expect(items2).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#digilocker-doc-list'))
      .toContainText(/All available documents have been imported/i);
  });

  test('closing the flow leaves the checklist intact', async ({ page }) => {
    await openDocuments(page);
    await connect(page);
    const close = page.locator('[id*=digilocker] button[aria-label*="lose" i], button:has-text("Cancel"), button:has-text("Close")').first();
    if (await close.count()) {
      await close.click();
      await page.waitForTimeout(600);
    }
    await expect(page.locator('#doc-checklist-container')).toBeVisible();
  });
});
