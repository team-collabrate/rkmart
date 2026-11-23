import { defineConfig, devices } from '@playwright/test'

// End-to-end tests: a real browser (phone size) clicks through the demo build of the app, the
// way a shop owner, the admin and the delivery person would. The demo build keeps its data in
// memory, so each test file runs one story from start to finish without reloading the page.
// Run: npm run e2e -w apps/web   (builds the demo app first)
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Pixel 7'],
    // Optional: use a browser that is already on this computer (set E2E_CHROME to its path).
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {},
  },
  webServer: {
    command: 'npm run build:demo && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
