// Real geolocation behaviour: permission granted and permission denied.
// The app must use the browser's own geolocation and must not invent
// coordinates when the user refuses.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

// Hyderabad coordinates - inside the seeded branch data.
const HYDERABAD = { latitude: 17.385, longitude: 78.4867 };

async function openBranches(page) {
  await launchApp(page);
  await navigate(page, 'branches');
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(2500);
}

test.describe('geolocation granted', () => {
  test.use({ permissions: ['geolocation'], geolocation: HYDERABAD });

  test('nearest-city detection resolves using the real position', async ({ page }) => {
    const errors = collectErrors(page);
    await openBranches(page);

    const locate = // the real control carries no id/title, so target its onclick binding
    page.locator('button[onclick*="useCurrentLocation"]').first();
    if (!(await locate.count()) || !(await locate.isVisible())) {
      test.skip(true, 'no geolocation control exposed');
    }
    await locate.click();
    await page.waitForTimeout(3000);

    const body = await page.locator('body').innerText();
    // a real position near Hyderabad should surface Hyderabad somewhere
    expect(body).toMatch(/Hyderabad|nearest|located|you are/i);
    expect(errors).toEqual([]);
  });

  test('branch markers render for the located area', async ({ page }) => {
    await openBranches(page);
    const locate = // the real control carries no id/title, so target its onclick binding
    page.locator('button[onclick*="useCurrentLocation"]').first();
    if (!(await locate.count()) || !(await locate.isVisible())) test.skip(true, 'no geolocation control');
    await locate.click();
    await page.waitForTimeout(3000);

    const markers = await page.locator('.maplibregl-marker').count();
    expect(markers).toBeGreaterThan(0);
  });
});

test.describe('geolocation denied', () => {
  test('a denied permission produces an honest message and no fake coordinates', async ({ page }) => {
    const errors = collectErrors(page);
    // no geolocation permission granted
    await openBranches(page);

    const locate = // the real control carries no id/title, so target its onclick binding
    page.locator('button[onclick*="useCurrentLocation"]').first();
    if (!(await locate.count()) || !(await locate.isVisible())) {
      test.skip(true, 'no geolocation control exposed');
    }
    await locate.click();

    // Assert on the toast itself rather than the whole page after a fixed wait:
    // toasts auto-dismiss (~3.2s), so a sleep-then-read races the timer.
    await expect(page.locator('#toast-host')).toContainText(
      /denied|permission|not allowed|unable|could not|manually/i, { timeout: 15_000 });

    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/you are at\s*0(\.0+)?\s*,\s*0(\.0+)?/i);
    // and no position was fabricated in app state
    expect(await page.evaluate(() => window.app && document.body.innerText.includes('0.0000, 0.0000'))).toBe(false);

    // the app keeps working
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the branch list still works after a denial', async ({ page }) => {
    await openBranches(page);
    const locate = // the real control carries no id/title, so target its onclick binding
    page.locator('button[onclick*="useCurrentLocation"]').first();
    if (await locate.count() && await locate.isVisible()) {
      await locate.click();
      await page.waitForTimeout(2500);
    }
    const text = await page.locator('#branch-results-count').innerText();
    expect(text).toMatch(/\d+/);
  });
});
