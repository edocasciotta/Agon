import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Agon frontend e2e tests.
 *
 * Tests run against the Vite dev server (http://localhost:5173).
 * API calls to the FastAPI backend (http://localhost:8000) are
 * intercepted by page.route() in each test file — no real backend needed.
 *
 * To run: npm run test:e2e
 * To run with UI: npx playwright test --ui
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Vite dev server before tests; skip if already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
