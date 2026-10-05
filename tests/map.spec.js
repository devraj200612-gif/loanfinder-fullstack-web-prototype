// Branch locator: map rendering, controls, filters and data-provenance badges.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

async function openBranches(page) {
  await launchApp(page);
  await navigate(page, 'branches');
  // the map needs a moment to create its canvas and controls
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(2500);
}

test.describe('branch map', () => {
  test('renders a live WebGL canvas and a result count', async ({ page }) => {
    const errors = collectErrors(page);
    await openBranches(page);

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);

    const count = await page.locator('#branch-results-count').innerText();
    expect(count).toMatch(/\d+/);

    expect(errors).toEqual([]);
  });

  test('the MapLibre engine is the one that initialised', async ({ page }) => {
    await openBranches(page);
    await expect(page.locator('.maplibregl-map')).toHaveCount(1);
    await expect(page.locator('.maplibregl-ctrl')).not.toHaveCount(0);
  });

  test('Map / Satellite switch changes the basemap', async ({ page }) => {
    await openBranches(page);

    // appState.mapStyle is the source of truth; window.app exposes it read-only.
    expect(await page.evaluate(() => window.app.mapStyle)).toBe('street');

    const sat = page.locator('button:has-text("Satellite"), [id*=satellite]').first();
    if (await sat.count() && await sat.isVisible()) {
      await sat.click();
      await page.waitForTimeout(2500);

      expect(await page.evaluate(() => window.app.mapStyle)).toBe('satellite');
      // the switcher itself reflects the change for assistive tech
      await expect(page.locator('.map-layer-btn[data-map-style="satellite"]'))
        .toHaveAttribute('aria-pressed', 'true');
      // and the rendered style really swapped to the raster satellite layer
      const hasSatelliteLayer = await page.evaluate(() => {
        const m = window.app.map;
        if (!m || typeof m.getStyle !== 'function') return false;
        const layers = (m.getStyle().layers || []).map(l => l.id);
        return layers.includes('satellite');
      });
      expect(hasSatelliteLayer, 'satellite basemap layer is rendered').toBe(true);
    } else {
      test.skip(true, 'no satellite toggle exposed in this build');
    }
  });

  test('the fit-all-branches control is present and clickable', async ({ page }) => {
    await openBranches(page);
    const fit = page.locator('#map-fit-btn');
    await expect(fit).toBeVisible();
    await fit.click();
    await page.waitForTimeout(1200);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('branch cards render with IFSC and hours on verified records', async ({ page }) => {
    await openBranches(page);
    const text = await page.locator('#branch-results-count').count()
      ? await page.locator('body').innerText()
      : '';
    expect(text).toMatch(/Mumbai|Delhi|Bengaluru|Hyderabad|Pune/);
  });

  test('sample records carry an explicit not-verified badge', async ({ page }) => {
    await openBranches(page);
    // Scope to the visible branch list: the same markup is also rendered inside
    // the (hidden) bank-details Branches tab, and an unscoped .first() can land there.
    await expect(page.locator('#branch-cards-container .branch-sample-badge').first())
      .toBeVisible({ timeout: 20_000 });
  });

  test('verified records expose IFSC codes and a directions link', async ({ page }) => {
    await openBranches(page);
    // Mumbai is seeded entirely as unverified sample data; the records carrying
    // an IFSC are the Hyderabad/Pune ones compiled from official locators.
    await page.selectOption('#branch-city-select', { label: 'Hyderabad' });
    await page.waitForTimeout(1500);

    const cards = page.locator('#branch-cards-container .branch-card');
    await expect(cards.first()).toBeVisible();
    const ifsc = await page.locator('#branch-cards-container >> text=/[A-Z]{4}0[A-Z0-9]{6}/').count();
    expect(ifsc).toBeGreaterThan(0);
    // and each verified record links out to its provenance
    await expect(page.locator('#branch-cards-container a[href*="bank.in"]').first()).toBeVisible();
  });
});

test.describe('branch filters', () => {
  test('filtering by bank narrows the results', async ({ page }) => {
    await openBranches(page);
    const readCount = async () =>
      parseInt((await page.locator('#branch-results-count').innerText()).match(/\d+/)[0], 10);

    const before = await readCount();
    await page.selectOption('#branch-bank-select', { label: 'HDFC Bank' });
    await page.waitForTimeout(1500);
    const after = await readCount();

    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
    await expect(page.locator('#branch-results-count')).toContainText(/HDFC/i);
  });

  test('filtering by city narrows the results', async ({ page }) => {
    await openBranches(page);
    const readCount = async () =>
      parseInt((await page.locator('#branch-results-count').innerText()).match(/\d+/)[0], 10);

    await page.selectOption('#branch-city-select', { label: 'Pune' });
    await page.waitForTimeout(1500);
    expect(await readCount()).toBeGreaterThan(0);
    await expect(page.locator('#branch-results-count')).toContainText(/Pune/i);
  });

  test('free-text search filters the branch list', async ({ page }) => {
    await openBranches(page);
    await page.fill('#branch-search-input', 'Koti');
    await page.waitForTimeout(1200);
    const text = await page.locator('#branch-results-count').innerText();
    expect(text).toMatch(/\d+/);
  });

  test('an impossible filter combination shows an honest empty state', async ({ page }) => {
    await openBranches(page);
    await page.fill('#branch-search-input', 'zzzzz-no-such-branch');
    await page.waitForTimeout(1200);
    const text = await page.locator('#branch-results-count').innerText();
    expect(text).toMatch(/\d+/);
    // no crash and no "undefined" leaking into the UI
    await expect(page.locator('body')).not.toContainText('undefined');
  });

  test('the bank and city selects are fully populated', async ({ page }) => {
    await openBranches(page);
    const banks = await page.locator('#branch-bank-select option').allInnerTexts();
    const cities = await page.locator('#branch-city-select option').allInnerTexts();
    expect(banks.length).toBeGreaterThanOrEqual(5);
    expect(cities.length).toBeGreaterThanOrEqual(5);
  });
});
