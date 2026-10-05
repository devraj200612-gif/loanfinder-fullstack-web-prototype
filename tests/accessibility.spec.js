// Accessibility names, critical navigation flows, catalogue consistency, and the
// explicit "no console or page errors" guarantee across the whole app.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

const VIEWS = ['dashboard', 'eligibility', 'saved', 'p2p', 'profile', 'settings'];

/** An interactive element is "named" if it has any of these. */
function accessibleName(el) {
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy && labelledBy.split(/\s+/).some(id => (document.getElementById(id) || {}).textContent)) return 'labelledby';
  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();
  if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return 'label';
  if (el.closest('label')) return 'wrapped-label';
  if (el.labels && el.labels.length) return 'labels';
  const text = (el.textContent || '').trim();
  if (text) return text;
  const ph = el.getAttribute('placeholder');
  if (ph && ph.trim()) return ph.trim();
  const alt = el.getAttribute('alt');
  if (alt && alt.trim()) return alt.trim();
  return '';
}

test.describe('accessibility: every visible control has a name', () => {
  for (const view of VIEWS) {
    test(`all controls in "${view}" are named`, async ({ page }) => {
      await launchApp(page);
      await navigate(page, view);
      await page.waitForTimeout(600);

      const unnamed = await page.$$eval(
        'button, input, select, textarea, a[href], [role="button"], [role="checkbox"], [role="switch"]',
        (els) => els
          .filter(el => el.offsetParent !== null && !el.disabled)
          .filter(el => {
            const aria = el.getAttribute('aria-label');
            if (aria && aria.trim()) return false;
            const lb = el.getAttribute('aria-labelledby');
            if (lb && lb.split(/\s+/).some(id => (document.getElementById(id) || {}).textContent)) return false;
            const title = el.getAttribute('title');
            if (title && title.trim()) return false;
            if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false;
            if (el.closest('label')) return false;
            if (el.labels && el.labels.length) return false;
            if ((el.textContent || '').trim()) return false;
            const ph = el.getAttribute('placeholder');
            if (ph && ph.trim()) return false;
            const alt = el.getAttribute('alt');
            if (alt && alt.trim()) return false;
            return true;
          })
          .map(el => el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className || '').split(' ')[0])
      );

      expect(unnamed, 'controls with no accessible name in ' + view).toEqual([]);
    });
  }

  test('icon-only buttons carry an aria-label or title', async ({ page }) => {
    await launchApp(page);
    const bad = await page.$$eval('button', els => els
      .filter(el => el.offsetParent !== null)
      .filter(el => !(el.textContent || '').trim())
      .filter(el => !(el.getAttribute('aria-label') || '').trim() && !(el.getAttribute('title') || '').trim())
      .map(el => (el.id || '') + '.' + String(el.className || '').split(' ')[0]));
    expect(bad).toEqual([]);
  });
});

test.describe('critical navigation flows', () => {
  test('the sidebar reaches every view', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);

    for (const view of ['eligibility', 'saved', 'p2p', 'profile', 'settings']) {
      await navigate(page, view);
      await page.waitForTimeout(400);
      const visible = await page.$$eval('[id^="view-"]', els =>
        els.filter(e => e.offsetParent !== null).map(e => e.id).join(','));
      expect(visible, 'after navigating to ' + view).toContain('view-' + view);
    }
    expect(errors).toEqual([]);
  });

  test('global search filters results', async ({ page }) => {
    await launchApp(page);
    await page.fill('#global-search', 'home');
    await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toContain('home');
  });

  test('the escape key closes the topmost overlay', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');

    // open a real modal, the way a user does
    await page.locator('#digilocker-connect-btn').click();
    const modal = page.locator('#digilocker-modal');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // the checklist underneath is left intact
    await expect(page.locator('#doc-checklist-container')).toBeVisible();
  });

  test('a sign-in is required before the dashboard is reachable', async ({ page }) => {
    await page.goto(require('./helpers').APP_URL);
    await page.waitForTimeout(900);
    const visible = await page.$$eval('[id^="view-"]', els =>
      els.filter(e => e.offsetParent !== null).map(e => e.id).join(',') || '(none)');
    expect(visible).toBe('(none)');
  });
});

test.describe('catalogue consistency', () => {
  test('advertised counts match what the UI states', async ({ page }) => {
    await launchApp(page);
    const body = await page.locator('body').innerText();
    // the landing copy must not contradict the seeded catalogue
    expect(body).toMatch(/5 (Indian )?banks/i);
    expect(body).toMatch(/7 (live )?offers/i);
  });

  test('no stale or placeholder text leaks into the rendered app', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'dashboard');
    await navigate(page, 'branches');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\bundefined\b/);
    expect(body).not.toMatch(/\bNaN\b/);
    expect(body).not.toMatch(/\[object Object\]/);
    expect(body).not.toMatch(/Lorem ipsum/i);
  });

  test('the app object exposes its public API', async ({ page }) => {
    await launchApp(page);
    const api = await page.evaluate(() => Object.keys(window.app || {}));
    ['init', 'calcEMI', 'findBestMatches', 'renderHiddenCharges', 'connectDigiLocker',
      'downloadDocChecklist', 'navigateTo', 'toggleSaveOffer'].forEach(m => expect(api).toContain(m));
  });
});

test.describe('no console or page errors', () => {
  test('a full walkthrough produces none', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);

    for (const view of VIEWS) await navigate(page, view);
    await navigate(page, 'branches');
    await page.waitForTimeout(2000);
    await navigate(page, 'documents');

    expect(errors).toEqual([]);
  });
});
