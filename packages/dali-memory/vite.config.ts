import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/**/*.ts', '!src/**/__tests__/**/*.ts', '!src/**/*.spec.ts'],
    unbundle: true,
    exports: true,
    clean: true,
    dts: true,
    sourcemap: true,
    target: 'ES2022',
    format: 'esm',
    deps: {
      skipNodeModulesBundle: true,
    },
  },
});
