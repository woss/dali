#!/usr/bin/env node
/**
 * Publish @woss/dali-orm to JSR (jsr.io) in sync with the npm version.
 *
 * - Version source of truth: packages/dali-orm/package.json (changesets).
 *   jsr.json is normalized to it before every publish.
 * - Auth:
 *   • CI (GitHub Actions): OIDC — automatic. Requires the workflow's
 *     `id-token: write` permission and the package Settings → GitHub
 *     Repository link pointing at woss/dali. NO secret needed.
 *   • Local: interactive browser login, or pass JSR_TOKEN for headless.
 * - Uses the system `deno` binary directly. The npm `jsr` wrapper was dropped:
 *   v0.14.x fails to forward provenance flags to its bundled deno.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'packages', 'dali-orm');

const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
if (!pkg.version) throw new Error('No version in packages/dali-orm/package.json');

// Normalize jsr.json to the npm version so the two registries never diverge.
const jsrConfigPath = join(pkgDir, 'jsr.json');
const jsr = JSON.parse(readFileSync(jsrConfigPath, 'utf8'));
if (jsr.version !== pkg.version) {
  writeFileSync(
    jsrConfigPath,
    JSON.stringify({ ...jsr, version: pkg.version }, null, 2) + '\n',
  );
}

// Shared flag set the `jsr` wrapper uses for package.json-based packages.
// Provenance/token handling stays implicit so deno auto-detects CI + OIDC.
const PUBLISH_FLAGS = [
  '--unstable-bare-node-builtins',
  '--unstable-sloppy-imports',
  '--unstable-byonm',
  '--no-check',
];

let cmd, cmdArgs;
if (spawnSync('deno', ['--version'], { stdio: 'ignore' }).status === 0) {
  cmd = 'deno';
  cmdArgs = ['publish', ...PUBLISH_FLAGS];
  if (process.env.JSR_TOKEN) cmdArgs.push('--token', process.env.JSR_TOKEN);
} else {
  console.warn('system deno not found — falling back to npm jsr wrapper');
  cmd = 'pnpm';
  cmdArgs = [
    'dlx',
    'jsr@latest',
    'publish',
    ...PUBLISH_FLAGS,
    '--no-provenance', // wrapper's bundled deno rejects the positive flag
  ];
  if (process.env.JSR_TOKEN) cmdArgs.push('--token', process.env.JSR_TOKEN);
}

const result = spawnSync(cmd, cmdArgs, { cwd: pkgDir, stdio: 'inherit' });
process.exit(result.status ?? 1);
