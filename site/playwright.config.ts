import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (`npm run build` first). SITE-SPEC test plan.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173/', permissions: ['clipboard-read', 'clipboard-write'] },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
});
