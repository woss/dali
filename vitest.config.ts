import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Suppress Vite native module resolution warning (cosmetic Vite internal bug).
// console.warn/stderr.write patches run before vitest-plus installs its own
// Vite logger — the reference is missed. Instead, wrap via plugin configResolved
// to intercept AFTER vitest-plus sets config.customLogger.
const suppressViteWarningPlugin = {
  name: 'suppress-warnings',
  configResolved(config: { logger: { warn: (msg: string | Error, opts?: unknown) => void } }) {
    const origWarn = config.logger.warn.bind(config.logger);
    config.logger.warn = (msg: string | Error, opts?: unknown) => {
      if (typeof msg === 'string' && msg.includes('Invalid file URL')) return;
      origWarn(msg, opts);
    };
  },
};

export default defineConfig({
  plugins: [suppressViteWarningPlugin],
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['packages/dali-orm/**/*.test.ts', 'packages/dali-memory/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'old-stuff-no-touch/**', '**/__snapshots__/**'],
    logHeapUsage: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      cleanOnRerun: true,
      reportOnFailure: true,
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/*.test.ts',
        'old-stuff-no-touch/**',
      ],
    },
  },
});
