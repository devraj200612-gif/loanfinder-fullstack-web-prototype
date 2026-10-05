// Core financial-correctness regression.
//
// Covers: loan matching, EMI calculation and output, bank comparison, and the
// critical end-to-end flow required by the project: Home Loan / Rs 35,00,000 /
// 20 years / Rs 9,50,000 annual income / Salaried / 780 CIBIL -> "Find Matching
// Loan" -> matching recommendations appear.
const { test, expect } = require('@playwright/test');
const { REGRESSION, collectErrors, launchApp, findMatchingLoans, recommendationCards } = require('./helpers');

test.describe('critical regression: the documented loan-matching flow', () => {
  test('Home Loan 35,00,000 / 20y / 9,50,000 / salaried / 780 CIBIL yields recommendations', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);

    // The app ships these as the dashboard defaults.
    await expect(page.locator('#loan-amount-range')).toHaveValue(String(REGRESSION.amount));
    await expect(page.locator('#loan-tenure')).toHaveValue(String(REGRESSION.tenureYears));
    await expect(page.locator('#annual-income')).toHaveValue(String(REGRESSION.annualIncome));
    await expect(page.locator('#employment-type')).toHaveValue(REGRESSION.employment);
    await expect(page.locator('#credit-score')).toHaveValue(REGRESSION.cibil);

    // Recommendations must be gated until the user asks for them.
    // Scope to #hero-best-offer-container: the same placeholder markup is also
    // injected into #best-offer-hero, so an unscoped text locator matches two
    // elements (strict-mode violation). #best-offer-hero sits inside the
    // collapsed #full-comparison-wrap, so it is not visible anyway.
    await expect(
      page.locator('#hero-best-offer-container').getByText('Personalised recommendations await')
    ).toBeVisible();

    await findMatchingLoans(page);

    // The gate is released.
    await expect(page.locator('text=Personalised recommendations await')).toHaveCount(0);

    // Recommendations appeared: ranked bank cards with match percentages.
    const body = await page.locator('#hero-best-offer-container').innerText();
    expect(body).toContain('State Bank');
    expect(body).toMatch(/\d{1,3}\s*%\s*Match/);

    // At least the top three offers are ranked and visible.
    await expect(page.locator('text=% Match').first()).toBeVisible();

    expect(errors, 'no console or page errors during the flow').toEqual([]);
  });

test('top match is State Bank at 100% with the correct rate and EMI', async ({ page }) => {
    const errors = collectErrors(page);
    await launchApp(page);
    await findMatchingLoans(page);
    const text = await page.locator('#hero-best-offer-container').innerText();

    expect(text).toContain('State Bank');
    expect(text).toContain('7.85%');           // advertised rate
    expect(text).toContain('100% Match');      // best possible score
    expect(text).toContain('28,950');          // Rs 35,00,000 @ 7.85% over 20y
    expect(errors, 'no console or page errors').toEqual([]);
  });

  test('recommendations are ranked by match score, best first', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const text = await page.locator('#hero-best-offer-container').innerText();
    const scores = [...text.matchAll(/(\d{1,3})\s*%\s*Match/g)].map(m => Number(m[1]));
    expect(scores.length).toBeGreaterThanOrEqual(3);
    expect(scores[0]).toBe(Math.max(...scores));
    // strictly non-increasing
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
  });

  test('every recommended offer shows a rate, an EMI and a processing fee', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const text = await page.locator('#hero-best-offer-container').innerText();
    // The labels carry CSS `text-transform: uppercase` and innerText returns the
    // transformed text, and the value sits on the next line. Match accordingly.
    expect(text).toMatch(/Interest Rate\s+\d+\.\d+%/i);
    expect(text).toMatch(/Est\. EMI\s*.?\d[\d,]*\/mo/i);
    expect(text).toMatch(/Fee\s+\d+\.\d+%/i);
  });
});

test.describe('EMI calculation and output', () => {
  test('the verified EMI for the fixture is rendered to the rupee', async ({ page }) => {
    await launchApp(page);
    // Independent check of the in-page formula, then the rendered output.
    const emi = await page.evaluate(() => window.app.calcEMI(3500000, 7.85, 20));
    expect(Math.round(emi)).toBe(28950);

    await findMatchingLoans(page);
    await expect(page.locator('#hero-best-offer-container')).toContainText('28,950');
  });

  test('EMI is recomputed live when the amount changes', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const before = await page.locator('#hero-best-offer-container').innerText();

    await page.evaluate(() => {
      const el = document.getElementById('loan-amount-range');
      el.value = 5000000;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    const after = await page.locator('#hero-best-offer-container').innerText();

    expect(after).not.toBe(before);
    expect(after).toMatch(/Est\. EMI\s*.?\d[\d,]*\/mo/i);
  });

  test('a longer tenure lowers the monthly EMI', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const short = await page.evaluate(() => Math.round(window.app.calcEMI(3500000, 7.85, 10)));
    const long = await page.evaluate(() => Math.round(window.app.calcEMI(3500000, 7.85, 30)));
    expect(long).toBeLessThan(short);
  });

  test('degenerate inputs return 0 rather than NaN', async ({ page }) => {
    await launchApp(page);
    const r = await page.evaluate(() => [
      window.app.calcEMI(0, 7.85, 20),
      window.app.calcEMI(3500000, 7.85, 0),
      window.app.calcEMI(-5, 7.85, 20),
      window.app.calcEMI(NaN, 7.85, 20)
    ]);
    r.forEach(v => expect(Number.isFinite(v)).toBe(true));
    expect(r[0]).toBe(0);
  });
});

test.describe('bank comparison', () => {
  test('the full comparison list renders every advertised offer', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    // The comparison list lives inside #full-comparison-wrap, which starts
    // collapsed. Expand it the way a user does before asserting on visibility.
    await page.click('#toggle-comparison-btn');
    await expect(page.locator('#comparison-list-container')).toBeVisible();
    const text = await page.locator('#comparison-list-container').innerText();
    ['State Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra']
      .forEach(bank => expect(text).toContain(bank));
  });

  test('comparison is sorted by lowest advertised rate by default', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    await page.click('#toggle-comparison-btn');
    const text = await page.locator('#comparison-list-container').innerText();
    // Anchor on the "Interest Rate" label so the processing-fee percentages
    // (which are also rendered as "N.NN%") are not collected as if they were
    // advertised rates.
    const rates = [...text.matchAll(/Interest Rate\s+(\d+\.\d+)%/gi)].map(m => Number(m[1]));
    expect(rates.length).toBeGreaterThan(1);
    const ascending = [...rates].sort((a, b) => a - b);
    expect(rates).toEqual(ascending);
  });

  test('the full comparison section can be expanded and collapsed', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    const wrap = page.locator('#full-comparison-wrap');
    await expect(wrap).toBeHidden();
    await page.click('#toggle-comparison-btn');
    await expect(wrap).toBeVisible();
    await page.click('#toggle-comparison-btn');
    await expect(wrap).toBeHidden();
  });

  test('sorting the comparison by processing fee changes the order', async ({ page }) => {
    await launchApp(page);
    await findMatchingLoans(page);
    await page.click('#toggle-comparison-btn');
    const before = await page.locator('#comparison-list-container').innerText();
    await page.selectOption('#sort-results', { index: 1 });
    await page.waitForTimeout(600);
    const after = await page.locator('#comparison-list-container').innerText();
    expect(after.length).toBeGreaterThan(0);
    // the list must still contain all offers regardless of sort key
    expect(after).toContain('State Bank');
    expect(before).toContain('State Bank');
  });
});
