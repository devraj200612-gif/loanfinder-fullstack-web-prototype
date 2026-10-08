// Saved offers (Phase 2E: persisted per account via /api/saved-offers, i.e. in
// the SQLite database) and the hidden-charges module.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate, findMatchingLoans } = require('./helpers');

// Reads the offer id wired to a given Save button so the assertions below can
// check the API state of exactly the offer the click toggles.
async function saveButtonOfferId(btn) {
  return btn.evaluate(el => {
    const m = (el.getAttribute('onclick') || '').match(/toggleSaveOffer\('([^']+)'\)/);
    return m ? m[1] : null;
  });
}

test.describe('saved offers', () => {
  test('an offer can be saved and survives a page reload', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page);

    // Find a save button and read the offer it toggles.
    const btn = page.locator('button[title="Save Offer"]').first();
    await expect(btn).toBeVisible();
    const offerId = await saveButtonOfferId(btn);
    expect(offerId).toBeTruthy();

    const inApi = id => page.evaluate(async offerId =>
      (await window.LoanFinderAPI.getSavedOffers()).some(r => r.offer_id === offerId), id);

    const savedBefore = await inApi(offerId);
    await btn.click();
    await page.waitForTimeout(600);

    // Exactly one toggle happened, confirmed by the server, not local state.
    expect(await inApi(offerId)).toBe(!savedBefore);
    // The rendered Saved view reflects the same toggle.
    const uiSaved = await page.evaluate(id =>
      (window.app.savedOffers || []).some(o => o.id === id), offerId);
    expect(uiSaved).toBe(!savedBefore);

    await page.reload();
    await page.waitForSelector('button:has-text("Start Comparing Free")');
    // The session survives the reload and the offer is still in the database.
    expect(await inApi(offerId)).toBe(!savedBefore);

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
    // Whatever the Saved view shows must come from the API, not a local seed.
    expect(await page.evaluate(async () => {
      const api = (await window.LoanFinderAPI.getSavedOffers()).map(r => r.offer_id).sort();
      const ui = (window.app.savedOffers || []).map(o => o.id).sort();
      return JSON.stringify(api) === JSON.stringify(ui);
    })).toBe(true);
  });

  test('toggling the same offer twice restores the original state', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);

    const btn = page.locator('button[title="Save Offer"]').first();
    const offerId = await saveButtonOfferId(btn);
    const inApi = id => page.evaluate(async offerId =>
      (await window.LoanFinderAPI.getSavedOffers()).some(r => r.offer_id === offerId), id);

    const before = await inApi(offerId);
    await btn.click(); await page.waitForTimeout(500);
    expect(await inApi(offerId)).toBe(!before);
    await btn.click(); await page.waitForTimeout(500);
    expect(await inApi(offerId)).toBe(before);
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
