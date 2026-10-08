// Playwright configuration for the LoanFinder app.
//
// Phase 2D: the frontend is served over HTTP by the Express backend (server.js)
// and reads its catalogue data from the /api endpoints, so the Playwright
// suite runs against a real web server instead of file://. Tests are still
// serialised per worker because the app keeps view state in a single shared
// object and a map style cache.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  outputDir: 'test-results',
  webServer: {
    // `npm run pretest` (db:init + db:validate) runs automatically before
    // `npm test`, so the database is always rebuilt and checked from the
    // canonical dataset before the server starts. The base URL must stay in
    // sync with tests/helpers.js (APP_URL).
    // AUTH_RATE_LIMIT_MAX is relaxed for the shared suite server so the many
    // legitimate test logins never trip the auth limiter; the limiter's real
    // behaviour is asserted against a dedicated server in api-auth.spec.js.
    command: 'node server.js',
    url: 'http://127.0.0.1:8080/api/health',
    env: { ...process.env, AUTH_RATE_LIMIT_MAX: '100000' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
