import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:7777',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec vite dev --port 7777',
    port: 7777,
    cwd: '/Users/woss/projects/woss/dali/packages/dali-memory',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
