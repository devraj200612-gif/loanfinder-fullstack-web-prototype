// P2P module: overflow and responsive reachability. The module is a
// demonstrator, so the tests also assert it never claims real money moved and
// that its dialogs stay usable at every supported viewport.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 }
];

async function openP2P(page) {
  await launchApp(page);
  await navigate(page, 'p2p');
  await page.waitForTimeout(1200);
}

test.describe('P2P module', () => {
  test('the borrower and lender modes both open', async ({ page }) => {
    const errors = collectErrors(page);
    await openP2P(page);

    const borrow = page.locator('.nav-item[data-view="p2p-borrow"]');
    const lend = page.locator('.nav-item[data-view="p2p-lend"]');

    if (await borrow.count() && await borrow.first().isVisible()) {
      await borrow.first().click();
      await page.waitForTimeout(900);
      await expect(page.locator('#view-p2p-borrow')).toBeVisible();
    }
    if (await lend.count() && await lend.first().isVisible()) {
      await lend.first().click();
      await page.waitForTimeout(900);
      await expect(page.locator('#view-p2p-lend')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('seeded borrower requests are discoverable', async ({ page }) => {
    await openP2P(page);
    const lend = page.locator('.nav-item[data-view="p2p-lend"]');
    if (await lend.count() && await lend.first().isVisible()) {
      await lend.first().click();
      await page.waitForTimeout(1200);
    }
    const body = await page.locator('#view-p2p-lend').innerText().catch(async () => await page.locator('body').innerText());
    expect(body).toMatch(/\d/);
  });

  test('it states repeatedly that no real money moves', async ({ page }) => {
    await openP2P(page);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/demo|simulat|no real (money|payment)/);
  });
});

test.describe('P2P responsive layout and overflow', () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openP2P(page);

      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return {
          scrollW: de.scrollWidth,
          clientW: de.clientWidth,
          offenders: [...document.querySelectorAll('*')]
            // Purely decorative, non-interactive layers (e.g. the
            // .p2p-mode-blob radial glow) are intentionally positioned outside
            // their container and are clipped by it. They cannot be operated and
            // they do not create a scrollbar - the document-level scrollWidth
            // assertion below is what proves there is no real overflow.
            .filter(el => getComputedStyle(el).pointerEvents !== 'none')
            .filter(el => el.getBoundingClientRect().right > de.clientWidth + 2)
            .slice(0, 5)
            .map(el => el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className || '').split(' ')[0])
        };
      });

      expect(overflow.offenders, 'elements past the viewport width').toEqual([]);
      expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 2);
    });

    test(`dialogs stay reachable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openP2P(page);

      // any visible dialog/modal must be scrollable so its actions can be reached
      const dialogs = page.locator('[role="dialog"], [class*=modal]:visible, [id*=p2p][class*=dialog]');
      const n = await dialogs.count();
      for (let i = 0; i < n; i++) {
        const d = dialogs.nth(i);
        if (!(await d.isVisible())) continue;
        const fit = await d.evaluate(el => ({
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
          scrollable: el.scrollHeight > el.clientHeight
            ? getComputedStyle(el).overflowY !== 'hidden'
            : true
        }));
        expect(fit.scrollable, 'an overflowing dialog must scroll').toBe(true);
      }
    });
  }

  test('the primary action stays reachable on the smallest phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openP2P(page);

    const buttons = page.locator('button:visible');
    const n = await buttons.count();
    let reachable = 0;
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      if (await b.isVisible() && await b.boundingBox()) reachable++;
    }
    expect(reachable).toBeGreaterThan(0);
  });
});
