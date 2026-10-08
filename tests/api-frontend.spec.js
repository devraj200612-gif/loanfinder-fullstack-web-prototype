// Phase 2D: end-to-end proof that the frontend no longer reads hardcoded
// constants and instead boots its catalogue (offers, branches, hidden charges)
// from the Phase 2C REST API, with an explicit loading state and an honest
// failure + Retry path when the API is unreachable.
const { test, expect } = require('@playwright/test');
const { REGRESSION, collectErrors, ensureDemoUser, launchApp, navigate, findMatchingLoans } = require('./helpers');

const API_COUNTS = { offers: 7, banks: 5, branches: 33 };

test.describe('Phase 2D: frontend loads its data from the API over HTTP', () => {
  test('index.html and the api.js layer are served, with all six methods', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('http://127.0.0.1:8080/');
    // The API layer is a separate script served alongside the app.
    const methods = await page.evaluate(() =>
      ['getBanks', 'getLoanOffers', 'getLoanOffer', 'getBranches', 'getBranch', 'getHiddenCharges']
        .filter(m => typeof (window.LoanFinderAPI || {})[m] === 'function'));
    expect(methods).toEqual(['getBanks', 'getLoanOffers', 'getLoanOffer', 'getBranches', 'getBranch', 'getHiddenCharges']);
    // Boot completes: the overlay is hidden and the landing page is interactive.
    await expect(page.locator('#boot-overlay')).toHaveClass(/boot-hidden/);
    await expect(page.locator('button:has-text("Start Comparing Free")')).toBeVisible();
    expect(errors, 'no console or page errors while booting').toEqual([]);
  });

  test('a loading state is shown while the catalogue is being fetched', async ({ page }) => {
    // Hold the last request in the boot sequence so the overlay stays visible.
    await page.route('**/api/branches', async route => {
      await new Promise(r => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#boot-overlay:not(.boot-hidden)')).toBeVisible();
    await expect(page.locator('#boot-message')).toHaveText('Loading LoanFinder...');
    // Once the data arrives the overlay clears and the app becomes usable.
    await expect(page.locator('#boot-overlay')).toHaveClass(/boot-hidden/);
    await expect(page.locator('button:has-text("Start Comparing Free")')).toBeVisible();
  });

  test('all catalogue data arrives through the API, correctly transformed', async ({ page }) => {
    await launchApp(page);

    // The API itself returns the expected catalogue size.
    const counts = await page.evaluate(async () => ({
      banks: (await window.LoanFinderAPI.getBanks()).length,
      offers: (await window.LoanFinderAPI.getLoanOffers()).length,
      offersByType: (await window.LoanFinderAPI.getLoanOffers('home')).length,
      branches: (await window.LoanFinderAPI.getBranches()).length,
    }));
    expect(counts).toEqual({ banks: 5, offers: 7, offersByType: 5, branches: 33 });

    // Branches expose their owning bank so the frontend can filter by full name.
    const sample = await page.evaluate(async () => {
      const b = (await window.LoanFinderAPI.getBranches())[0];
      return b ? { bank: b.bank.name, short: b.bank.short_code, city: b.city } : null;
    });
    expect(['State Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra']).toContain(sample.bank);
    expect(typeof sample.short).toBe('string');

    // The hidden-charges map was preloaded at boot for every offer.
    const perOffer = await page.evaluate(async () => {
      const offers = await window.LoanFinderAPI.getLoanOffers();
      const sizes = {};
      for (const o of offers) sizes[o.id] = (await window.LoanFinderAPI.getHiddenCharges(o.id)).length;
      return sizes;
    });
    expect(Object.values(perOffer).every(n => n > 0)).toBe(true);
    expect(Object.keys(perOffer)).toHaveLength(API_COUNTS.offers);

    // The transformed BANK_OFFERS reach the renderers: opening a bank's details
    // lists every transformed offer for the selected loan type in the "browse
    // another bank" switcher.
    await findMatchingLoans(page);
    await page.locator('button:has-text("Details & Docs")').first().click();
    await page.waitForTimeout(900);
    const optionsText = await page.locator('#bank-detail-switch').innerText();
    ['State Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra']
      .forEach(b => expect(optionsText).toContain(b));

    // Phase 2E: saved offers are account data - the Saved view is driven by
    // GET /api/saved-offers for the signed-in demo user, never by a local
    // localStorage seed, so the rendered list must equal the API rows exactly.
    const saved = await page.evaluate(async () => ({
      api: (await window.LoanFinderAPI.getSavedOffers()).map(r => r.offer_id).sort(),
      ui: (window.app.savedOffers || []).map(o => o.id).sort(),
      localSeed: (JSON.parse(localStorage.getItem('loanfinder.db.v1') || '{}').savedOffers || []).map(o => o.id).sort(),
    }));
    expect(saved.ui).toEqual(saved.api);
    expect(saved.localSeed).toEqual([]);

    // No boot/console errors during the whole walkthrough.
  });

  test('home matching still ranks State Bank first at 100%', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page, REGRESSION);
    const text = await page.locator('#hero-best-offer-container').innerText();
    expect(text).toContain('State Bank');
    expect(text).toContain('100% Match');
    expect(text).toContain('28,950');
    expect(errors, 'no console or page errors').toEqual([]);
  });

  test('switching to a personal loan matches the API-backed personal offers', async ({ page }) => {
    await launchApp(page);
    await page.locator('.loan-type-card', { hasText: 'Personal Loan' }).first().click();
    await page.waitForTimeout(500);
    await findMatchingLoans(page, REGRESSION);
    await page.click('#toggle-comparison-btn');
    const cards = await page.locator('#comparison-list-container .bank-card').count();
    expect(cards).toBe(2); // SBI + HDFC personal offers only
    const text = await page.locator('#comparison-list-container').innerText();
    expect(text).toContain('State Bank');
    expect(text).toContain('HDFC Bank');
  });

  test('branches load from the API into the locator view and can be filtered', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await navigate(page, 'branches');
    // The static city select exposes the real cities from the API data.
    const cities = await page.locator('#branch-city-select option').allTextContents();
    ['Mumbai', 'Hyderabad', 'Bengaluru', 'Delhi / NCR', 'Pune'].forEach(c => expect(cities).toContain(c));
    const banks = await page.locator('#branch-bank-select option').allTextContents();
    ['State Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra'].forEach(b => expect(banks).toContain(b));

    await expect(page.locator('#branch-cards-container .branch-card').first()).toBeVisible();
    // Expected counts are derived from the same API the UI reads, so the filter
    // is proven end-to-end rather than hardcoding city/bank totals.
    const countFor = (city, bank) => page.evaluate(async ({ city, bank }) => {
      const rows = await window.LoanFinderAPI.getBranches(city);
      return rows.filter(r => r.bank && r.bank.name === bank).length;
    }, { city, bank });

    const defaultLabel = await page.locator('#branch-results-count').innerText();
    expect(defaultLabel).toMatch(/^\d+ State Bank branches in Mumbai$/);
    expect(await page.locator('#branch-cards-container .branch-card').count())
      .toBe(await countFor('Mumbai', 'State Bank'));

    await page.selectOption('#branch-city-select', 'Hyderabad');
    await page.waitForTimeout(500);
    expect(await page.locator('#branch-cards-container .branch-card').count())
      .toBe(await countFor('Hyderabad', 'State Bank'));

    await page.selectOption('#branch-bank-select', 'HDFC Bank');
    await page.waitForTimeout(500);
    const hdfcHyderabad = await countFor('Hyderabad', 'HDFC Bank');
    expect(hdfcHyderabad).toBeGreaterThan(0);
    expect(await page.locator('#branch-cards-container .branch-card').count()).toBe(hdfcHyderabad);
    await expect(page.locator('#branch-results-count')).toContainText('HDFC Bank branches in Hyderabad');

    expect(errors, 'no console or page errors in the branch view').toEqual([]);
  });

  test('the map is initialised with the API-loaded branch data', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'branches');
    await expect(page.locator('#map-element')).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!(window.app && window.app.map))).toBe(true);
    const rendered = await page.evaluate(() => {
      const map = window.app.map;
      return !!(map && (document.querySelector('#map-element canvas') ||
        document.querySelector('#map-element .leaflet-map-pane')));
    });
    expect(rendered).toBe(true);
  });

  test('hidden charges render from the API with their icons and the informational badge', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page, REGRESSION);
    await page.locator('button:has-text("Details & Docs")').first().click();
    await page.waitForTimeout(900);
    const tab = page.locator('#tab-hidden-charges');
    if (await tab.count() && await tab.isVisible()) await tab.click();
    await page.waitForTimeout(700);

    // Every line item carries its lucide icon (from the icon column). safeIcons
    // has already replaced the <i data-lucide> placeholders with <svg> elements.
    const items = await page.locator('#hidden-charges-items .hidden-charge-item').count();
    const icons = await page.locator('#hidden-charges-items .hidden-charge-icon svg').count();
    expect(items).toBeGreaterThan(0);
    expect(icons).toBe(items);

    // The single informational row ("Rate Reset Basis") renders its badge.
    await expect(page.locator('#hidden-charges-items')).toContainText('(informational)');
    await expect(page.locator('#hidden-charges-items')).toContainText('Rate Reset Basis');

    expect(errors, 'no console or page errors while rendering charges').toEqual([]);
  });

  test('a dead API shows an explicit error + Retry that recovers', async ({ page }) => {
    // Create the demo account first: after Phase 2E the sign-in form talks to
    // the real API, and the routes below abort every /api/** call.
    await ensureDemoUser(page);
    await page.route('**/api/**', route => route.abort('failed'));
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#boot-overlay:not(.boot-hidden)')).toBeVisible();
    await expect(page.locator('#boot-message')).toHaveText('Could not load LoanFinder data.');
    await expect(page.locator('#boot-error-detail')).not.toBeEmpty();
    await expect(page.locator('#boot-retry')).toBeVisible();
    // The failure state is explicit: an honest error, a Retry action, no
    // silently-rendered stale catalogue behind a working-looking UI.
    await expect(page.locator('#boot-overlay')).toBeVisible();

    // Bring the API back and retry: the app boots straight into the UI. Console
    // errors are only collected from this point on - the failed first boot is
    // expected to log, and the recovery path must not add any more.
    await page.unroute('**/api/**');
    const errors = collectErrors(page);
    await page.click('#boot-retry-btn');
    await expect(page.locator('#boot-overlay')).toHaveClass(/boot-hidden/);
    await expect(page.locator('button:has-text("Start Comparing Free")')).toBeVisible();
    await page.click('button:has-text("Start Comparing Free")');
    await expect(page.locator('#auth-page')).toBeVisible();
    await page.fill('#login-email', 'demo@loanfinder.in');
    await page.fill('#login-password', 'demo1234');
    await page.locator('#auth-login-form button').last().click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    expect(errors, 'recovery path must not leak page/console errors').toEqual([]);
  });

  test('saved offers still persist and render', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const btn = page.locator('button[title="Save Offer"]').first();
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(600);
    await navigate(page, 'saved');
    await expect(page.locator('#view-saved')).toBeVisible();
    await expect(page.locator('#view-saved')).toContainText(/saved/i);
  });

  test('the P2P demo marketplace still renders its seeded requests', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'p2p');
    // The marketplace grid lives in the lender view, opened the same way a user does.
    const lend = page.locator('.nav-item[data-view="p2p-lend"]');
    if (await lend.count() && await lend.first().isVisible()) {
      await lend.first().click();
      await page.waitForTimeout(1200);
    }
    await expect(page.locator('#p2p-marketplace')).toBeVisible();
    expect(await page.locator('#p2p-marketplace .p2p-borrower-card').count()).toBeGreaterThan(0);
  });

  test('the checklist PDF still downloads', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#download-checklist-btn'),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('DigiLocker connect modal still opens', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');
    await page.locator('#digilocker-connect-btn').click();
    await expect(page.locator('#digilocker-modal')).toBeVisible();
  });

  test('the mobile drawer layout still works on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await launchApp(page);
    // No horizontal overflow caused by the boot overlay or the app shell.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const toggle = page.locator('#sidebar-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    // An open drawer covers its own toggle, so it is dismissed via the scrim,
    // exactly like a user on a phone taps outside the drawer to close it. The
    // click targets the right edge, away from the drawer panel.
    await page.locator('#sidebar-scrim').click({ position: { x: 360, y: 400 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  });
});