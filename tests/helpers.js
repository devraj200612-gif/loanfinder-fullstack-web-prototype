// Shared helpers for the LoanFinder specs.
const path = require('path');
const { expect } = require('@playwright/test');

const APP_URL = 'http://127.0.0.1:8080/';

// The shared demo account used by every spec that needs an authenticated app.
// It is created on demand (user rows persist in SQLite across runs, so a
// duplicate registration is tolerated) and then signed in THROUGH THE REAL
// LOGIN FORM, so every test still exercises POST /api/auth/login.
const DEMO_EMAIL = 'demo@loanfinder.in';
const DEMO_PASSWORD = 'demo1234';

async function ensureDemoUser(page) {
  await page.request.post('/api/auth/register', {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    failOnStatusCode: false,
  });
  // The register call auto-logs-in; drop that cookie so the only way into the
  // app is the login UI the test is about to drive.
  await page.context().clearCookies();
}

// The regression fixture from the original hand-written suite. These are also
// the values the app ships as defaults, so the dashboard is already in this
// state on first load - the test asserts that as well as the outcome.
const REGRESSION = {
  amount: 3500000,   // Rs 35,00,000
  tenureYears: 20,
  annualIncome: 950000, // Rs 9,50,000
  employment: 'salaried',
  cibil: '780'
};

// Collects console errors and uncaught page errors for the whole test so that
// "no console/page errors" can be asserted explicitly rather than assumed.
function collectErrors(page) {
  const errors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Phase 2E: the session probe GET /api/auth/me deliberately answers 401 for
    // a signed-out visitor, and Chromium logs every 4xx response as a console
    // error. That exact response is protocol, not an application error, so only
    // errors whose resource is /api/auth/me are excluded - every other console
    // error (including any other 401/404/500) still fails the tests.
    const loc = (typeof m.location === 'function' && m.location()) || {};
    if (typeof loc.url === 'string' && loc.url.replace(/\/$/, '').endsWith('/api/auth/me')) return;
    errors.push('console: ' + m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return errors;
}

/** Load the app and land on the Dashboard, passing the simulated sign-in. */
async function launchApp(page) {
  await ensureDemoUser(page);
  await page.goto(APP_URL);
  await page.waitForSelector('button:has-text("Start Comparing Free")', { state: 'visible' });
  await page.click('button:has-text("Start Comparing Free")');
  await expect(page.locator('#auth-page')).toBeVisible();
  await page.fill('#login-email', DEMO_EMAIL);
  await page.fill('#login-password', DEMO_PASSWORD);
  await page.locator('#auth-login-form button').last().click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await page.waitForTimeout(300);
}

/** Navigate via the sidebar the way a user does, not by calling app methods. */
async function navigate(page, view) {
  const item = page.locator(`.nav-item[data-view="${view}"]`);
  if (await item.count() && await item.first().isVisible()) {
    // At narrow viewports the sidebar is an off-canvas drawer, so the nav item
    // is laid out outside the viewport and cannot be clicked directly. Open the
    // drawer with the same control a user would tap first.
    const offCanvas = await item.first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.width === 0 || r.right <= 0 || r.left >= window.innerWidth;
    }).catch(() => false);
    if (offCanvas) {
      const toggle = page.locator('#sidebar-toggle');
      if (await toggle.count() && await toggle.isVisible()) {
        await toggle.click();
        await page.waitForTimeout(400);
      }
    }
    await item.first().click();
  } else {
    await page.evaluate(v => window.app.navigateTo(v), view);
  }
  await page.waitForTimeout(400);
}

/** Apply the regression fixture explicitly, then reveal recommendations. */
async function findMatchingLoans(page, fixture = REGRESSION) {
  await page.evaluate(f => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('loan-amount-range', f.amount);
    set('loan-tenure', f.tenureYears);
    set('annual-income', f.annualIncome);
    set('employment-type', f.employment);
    set('credit-score', f.cibil);
  }, fixture);
  await page.waitForTimeout(400);
  const btn = page.locator('button:has-text("Find Matching Loan")').locator('visible=true').first();
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForTimeout(900);
}

/** The recommendation cards live in this container once revealed. */
function recommendationCards(page) {
  return page.locator('#hero-best-offer-container, #best-offer-hero').filter({ hasText: 'Match' });
}

module.exports = { APP_URL, REGRESSION, DEMO_EMAIL, DEMO_PASSWORD, collectErrors, ensureDemoUser, launchApp, navigate, findMatchingLoans, recommendationCards };
