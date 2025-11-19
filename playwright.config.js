import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // Run dev server before starting tests
  webServer: [
    {
      command: "bash -lc 'source .venv/bin/activate && cd backend && python app.py'",
      port: 5001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "cd frontend && npm run dev",
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
