import { defineConfig, devices } from '@playwright/test';

const e2ePort = 3100;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  use: { baseURL: e2eBaseUrl, trace: 'on-first-retry' },
  webServer: {
    command: `pnpm exec next dev --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_MOCK_AUTH_SECRET: 'safir-pocket-local-e2e',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
