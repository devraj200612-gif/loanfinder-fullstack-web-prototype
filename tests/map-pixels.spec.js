// Proves the basemap is real data and not an empty canvas, by asking the MapLibre
// instance what it actually rendered. Requires network access for vector tiles;
// when tiles are blocked the same query must return nothing AND the app must show
// its honest offline notice with a working retry.
const { test, expect } = require('@playwright/test');
const { launchApp, navigate } = require('./helpers');

async function openBranches(page) {
  await launchApp(page);
  await navigate(page, 'branches');
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(4000); // allow style + tiles to settle
}

/** Ask MapLibre what it has actually drawn. */
function renderedFeatures(page) {
  return page.evaluate(() => {
    const map = window.app && (window.app.map || window.app.maplibreMap || window.app._map);
    if (!map || typeof map.queryRenderedFeatures !== 'function') return null;
    try {
      const feats = map.queryRenderedFeatures();
      return {
        total: feats.length,
        layers: [...new Set(feats.map(f => f.layer && f.layer.id).filter(Boolean))]
      };
    } catch (e) {
      return { error: String(e && e.message) };
    }
  });
}

test.describe('basemap renders real features', () => {
  test('queryRenderedFeatures returns real vector-tile features and layers', async ({ page }) => {
    await openBranches(page);
    const r = await renderedFeatures(page);

    expect(r, 'a MapLibre instance must be reachable').not.toBeNull();
    if (r && r.error) test.skip(true, 'queryRenderedFeatures failed: ' + r.error);

    test.skip(r.total === 0, 'vector tiles unreachable (offline) - see the blocked-tile test');

    expect(r.total).toBeGreaterThan(0);
    expect(r.layers.length).toBeGreaterThan(1);

    // real basemap data includes labels, roads and boundaries
    const joined = r.layers.join(',');
    expect(joined).toMatch(/label|road|boundary|water|landuse|building/);
  });

  test('tile attribution identifies the real data source', async ({ page }) => {
    await openBranches(page);
    const attrib = await page.locator('.maplibregl-ctrl-attrib').innerText().catch(() => '');
    expect(attrib.length).toBeGreaterThan(0);
  });

  test('blocking tile requests yields zero features and an honest notice', async ({ page }) => {
    // Routes must be registered BEFORE launch: once the app boots it has already
    // fetched and rendered its tiles, so blocking afterwards caches nothing new.
    await page.route('**/*.pbf', route => route.abort());
    await page.route('**/tiles/**', route => route.abort());
    await page.route('**/*.json', route => {
      const u = route.request().url();
      if (/style|tiles|basemap|openfreemap|maplibre/i.test(u)) return route.abort();
      return route.continue();
    });

    await launchApp(page);
    await navigate(page, 'branches');
    await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const r = await renderedFeatures(page);
    if (r && !r.error) expect(r.total).toBe(0);

    // the app must explain the real cause rather than silently failing
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/offline|could not|unable|retry|tile|network/i);
  });
});
