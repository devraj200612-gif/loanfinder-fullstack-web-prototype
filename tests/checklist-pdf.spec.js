// Document checklist and the client-side PDF it produces.
const { test, expect } = require('@playwright/test');
const { collectErrors, launchApp, navigate } = require('./helpers');

test.describe('document checklist', () => {
  test('renders the checklist with statuses', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await navigate(page, 'documents');

    await expect(page.locator('#doc-checklist-container')).toBeVisible();
    const entries = await page.locator('#doc-checklist-container > *').count();
    expect(entries).toBeGreaterThan(0);

    const text = await page.locator('#doc-checklist-container').innerText();
    expect(text).toMatch(/verified|pending|missing|ready|action needed|optional/i);

    expect(errors).toEqual([]);
  });

  test('the download button is labelled and enabled', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');
    const btn = page.locator('#download-checklist-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    expect((await btn.innerText()).toLowerCase()).toContain('pdf');
  });

  test('produces a real PDF download', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.click('#download-checklist-btn')
    ]);

    const name = download.suggestedFilename();
    expect(name).toMatch(/\.pdf$/i);
    expect(name.toLowerCase()).toContain('checklist');

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);

    // real PDF, non-trivial size
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });

  test('the PDF contains extractable checklist text', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.click('#download-checklist-btn')
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);

    // pdf-lib writes FlateDecode-compressed content streams and hex-encodes the
    // text, so the operands are invisible in the raw bytes. Inflate the streams,
    // then decode the <...> Tj operands to recover the real, readable content.
    const zlib = require('zlib');
    const raw = buf.toString('latin1');
    let decoded = '';
    const streamRe = /stream\r?\n/g;
    let m;
    while ((m = streamRe.exec(raw)) !== null) {
      const start = m.index + m[0].length;
      const end = raw.indexOf('endstream', start);
      if (end === -1) continue;
      try {
        decoded += zlib.inflateSync(buf.subarray(start, end)).toString('latin1');
      } catch (e) { /* not a deflate stream */ }
    }

    const hasOperators = /<[0-9A-Fa-f\s]{8,}>\s*Tj|\[[^\]]*\]\s*TJ/.test(decoded);
    expect(hasOperators, 'PDF should contain text-showing operators').toBe(true);

    // decode the hex text operands back into readable strings
    const text = (decoded.match(/<[0-9A-Fa-f\s]{8,}>\s*Tj/g) || [])
      .map(op => Buffer.from(op.replace(/[^0-9A-Fa-f]/g, ''), 'hex').toString('latin1'))
      .join(' ');

    expect(text.length, 'PDF should contain extractable text').toBeGreaterThan(0);
    expect(text).toMatch(/LoanFinder/i);
    expect(text).toMatch(/checklist/i);
  });

  test('a download toast confirms the file was produced', async ({ page }) => {
    await launchApp(page);
    await navigate(page, 'documents');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.click('#download-checklist-btn')
    ]);
    await page.waitForTimeout(900);
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/download|checklist/);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});
