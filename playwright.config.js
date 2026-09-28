import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the real WASM generator in Chromium against the Vite dev server.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // model generation can take a while on CI runners; the 5 s default is too tight
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3001/scherzo/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --strictPort',
    url: 'http://localhost:3001/scherzo/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
