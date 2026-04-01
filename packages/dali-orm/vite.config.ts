import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      skipNodeModulesBundle: true,
    },
    entry: ['src/**/*.ts', '!src/**/__tests__/**/*.ts', '!**/*.spec.ts', '!**/*.test.ts'],
    unbundle: true,
    exports: true,
    dts: true,
    target: 'ES2022',
    format: 'esm',
  },
});
