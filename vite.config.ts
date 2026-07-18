import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    cache: {
      scripts: true, // Cache package.json scripts run via vp run
      tasks: true, // Cache task definitions (default)
    },
    tasks: {
      // Named "ci" to avoid collision with per-package "build" scripts.
      // CI pipeline uses this. Output paths archive dist/ for restore.
      ci: {
        command: 'pnpm run build',
        output: ['packages/*/dist/**'],
        dependsOn: [],
      },
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: [
      '**/.opencode/plugins/**',
      'packages/dali-memory/.opencode/**',
      '**/dist/**',
      'examples/**',
      '**/meta/_journal.json',
      'packages/dali-memory/dali-memory.schema.json',
      'surreal-docs/**',
    ],
    singleQuote: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    rules: { 'unicorn/no-thenable': 'off' },
    ignorePatterns: [
      '.opencode/plugins/**',
      'packages/dali-memory/.opencode/**',
      '**/dist/**',
      'examples/**',
      '**/meta/_journal.json',
      'packages/dali-memory/dali-memory.schema.json',
      'surreal-docs/**',
    ],
  },
});
