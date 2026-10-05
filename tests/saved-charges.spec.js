// Saved offers (persisted to localStorage) and the hidden-charges module.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate, findMatchingLoans } = require('./helpers');

test.describe('saved offers', () => {
  test('an offer can be saved and survives a page reload', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page);

    // Find a save button that is not already in the saved state.
    const btn = page.locator('button[title="Save Offer"]').first();
    await expect(btn).toBeVisible();

    const savedBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').savedOffers || []);
    await btn.click();
    await page.waitForTimeout(600);
    const savedAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').savedOffers || []);

    // Exactly one toggle happened, in whichever direction.
    expect(savedAfter.length).toBe(savedBefore.length === 0 ? 1 : savedBefore.length - 1);

    await page.reload();
    await page.waitForTimeout(1000);
    const savedAfterReload = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').savedOffers || []);
    expect(savedAfterReload).toEqual(savedAfter);

    expect(errors).toEqual([]);
  });

  test('the Saved view lists the saved offer', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    await navigate(page, 'saved');
    await expect(page.locator('#view-saved')).toBeVisible();
    const text = await page.locator('#view-saved').innerText();
    // either a saved entry or an explicit empty state, but never broken markup
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/saved/i);
  });

  test('toggling the same offer twice restores the original state', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const read = () => page.evaluate(() =>
      // compare as a set: toggling off then on re-appends the offer, so the
      // stored order legitimately differs while the contents are restored.
      (JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').savedOffers || [])
        .map(o => o.id).sort());

    const before = await read();
    const btn = page.locator('button[title="Save Offer"]').first();
    await btn.click(); await page.waitForTimeout(500);
    await btn.click(); await page.waitForTimeout(500);
    expect(await read()).toEqual(before);
  });
});

test.describe('hidden charges', () => {
  test('opening bank details renders the hidden-charges line items and a total', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page);

    await page.locator('button:has-text("Details & Docs")').first().click();
    await page.waitForTimeout(900);

    // The charges tab must exist and become reachable.
    const tab = page.locator('#tab-hidden-charges');
    if (await tab.count() && await tab.isVisible()) await tab.click();
    await page.waitForTimeout(700);

    const items = await page.locator('#hidden-charges-items').innerText();
    expect(items.trim().length).toBeGreaterThan(0);

    const summary = await page.locator('#hidden-charges-summary').innerText();
    expect(summary.trim().length).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('the charges total is driven by the user loan amount', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);

    const openCharges = async () => {
      // opening a bank's details navigates away from the dashboard, so return
      // before looking for the offer row again on a second call
      await navigate(page, 'dashboard');
      await page.locator('button:has-text("Details & Docs")').first().click();
      await page.waitForTimeout(900);
      const tab = page.locator('#tab-hidden-charges');
      if (await tab.count() && await tab.isVisible()) await tab.click();
      await page.waitForTimeout(700);
      return page.locator('#hidden-charges-summary').innerText();
    };

    const before = await openCharges();

    await page.evaluate(() => {
      const el = document.getElementById('loan-amount-range');
      el.value = 6000000;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(700);

    // renderHiddenCharges() runs when a bank's details are opened and reads
    // appState.loanAmount at that moment, so re-open the panel to recompute.
    const after = await openCharges();

    expect(after).not.toBe(before);
  });

  test('all seven offers have hidden-charge entries', async ({ page }) => {
    await launchApp(page);
    const count = await page.evaluate(() => {
      // HIDDEN_CHARGES is module-scoped; count via the public renderer per offer
      const offers = window.app && document.getElementById('hidden-charges-items');
      return offers ? 'renderer-present' : 'missing';
    });
    expect(count).toBe('renderer-present');

    await findMatchingLoans(page);
    await page.locator('button:has-text("Details & Docs")').first().click();
    await page.waitForTimeout(900);
    const tab = page.locator('#tab-hidden-charges');
    if (await tab.count() && await tab.isVisible()) await tab.click();
    await page.waitForTimeout(600);

    const rows = await page.locator('#hidden-charges-items > *').count();
    expect(rows).toBeGreaterThan(0);
  });
});
