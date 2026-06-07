#!/usr/bin/env node
/**
 * Manual version bump for dali monorepo.
 *
 * Usage:
 *   pnpm bump               # Interactive prompts
 *   pnpm bump patch         # Prompt for package
 *   pnpm bump patch both    # Both packages (default)
 *   pnpm bump patch orm     # Only @woss/dali-orm
 *   pnpm bump minor memory  # Only @woss/dali-memory
 *
 * Bumps package versions, commits via but, CI handles tagging on merge.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

type SemverBump = 'patch' | 'minor' | 'major';

const VALID_BUMPS: SemverBump[] = ['patch', 'minor', 'major'];

function parseVersion(version: string): number[] {
  return version.split('.').map(Number);
}

function bumpVersion(version: string, type: SemverBump): string {
  const parts = parseVersion(version);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver: ${version}`);
  }
  switch (type) {
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'major':
      return `${parts[0] + 1}.0.0`;
  }
}

function parseButStatus(output: string, targets: string[]): { branchName: string; fileIds: string[] } {
  let branchName = 'main';
  const fileIds: string[] = [];
  const lines = output.split('\n');

  // Find applied branch name
  for (const line of lines) {
    const match = line.match(/^\s{2}(\S+)\s+\[b\d+\]\s+\(applied\)/);
    if (match) {
      branchName = match[1];
      break;
    }
  }

  // Find file IDs for the given package.json paths
  // IDs are 2-char alphanumeric like `ab`, `a1`, `c3`
  for (const line of lines) {
    for (const target of targets) {
      const fm = line.match(new RegExp(`${target}\\s+\\[([a-z0-9]{2})\\]`));
      if (fm && !fileIds.includes(fm[1])) {
        fileIds.push(fm[1]);
      }
    }
  }

  return { branchName, fileIds };
}

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, '..');

  let bumpType = process.argv[2] as SemverBump | undefined;
  let packageChoice = process.argv[3] as string | undefined;

  // Interactive prompt for bump type if not provided
  if (!bumpType || !VALID_BUMPS.includes(bumpType)) {
    const answer = await prompt(`Bump type? (${VALID_BUMPS.join('/')}): `);
    if (!VALID_BUMPS.includes(answer as SemverBump)) {
      console.error(`Invalid: ${answer}. Choose ${VALID_BUMPS.join('/')}.`);
      process.exit(1);
    }
    bumpType = answer as SemverBump;
  }

  // Interactive prompt for package if not provided
  const VALID_PACKAGES = ['orm', 'memory', 'both'] as const;
  if (!packageChoice || !(['orm', 'memory', 'both'] as string[]).includes(packageChoice)) {
    const answer = await prompt('Package? (orm/memory/both): ');
    if (!(['orm', 'memory', 'both'] as string[]).includes(answer)) {
      console.error(`Invalid: ${answer}. Choose orm, memory, or both.`);
      process.exit(1);
    }
    packageChoice = answer;
  }

  // All available packages
  const allPackages = [
    { name: '@woss/dali-orm', file: 'packages/dali-orm/package.json' },
    { name: '@woss/dali-memory', file: 'packages/dali-memory/package.json' },
  ];

  // Filter packages based on choice
  // Order matters: dali-orm first since dali-memory depends on it
  const packages = packageChoice === 'both'
    ? allPackages
    : allPackages.filter(p =>
        (packageChoice === 'orm' && p.name === '@woss/dali-orm') ||
        (packageChoice === 'memory' && p.name === '@woss/dali-memory')
      );

  // Read current versions from first package
  const firstPkg = JSON.parse(readFileSync(resolve(root, packages[0].file), 'utf-8'));
  const currentVersion = firstPkg.version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`Bumping ${currentVersion} → ${newVersion} (${bumpType}) [${packages.map(p => p.name).join(', ')}]`);

  // Update each package's version
  for (const pkg of packages) {
    const pkgPath = resolve(root, pkg.file);
    const json = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    json.version = newVersion;

    // Update workspace dependency references to new version
    if (json.dependencies) {
      for (const [, ver] of Object.entries(json.dependencies)) {
        if (typeof ver === 'string' && ver.startsWith('workspace:*')) {
          // Keep workspace:* references — pnpm resolves these at publish time
          continue;
        }
      }
    }

    writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n');
    console.log(`  ✓ ${pkg.name} → ${newVersion}`);
  }

  // Get branch name and file IDs from but status
  let branchName = 'main';
  let fileIds: string[] = [];
  const targets = packages.map(p => p.file);

  try {
    const statusOutput = execSync('but status -fv', { cwd: root, encoding: 'utf-8' });
    const parsed = parseButStatus(statusOutput, targets);
    branchName = parsed.branchName;
    fileIds = parsed.fileIds;
  } catch {
    // but not available — fall through with defaults
  }

  if (fileIds.length === 0) {
    console.log('No changes to commit — working tree is clean.');
    process.exit(0);
  }

  // Commit via but (no tag — CI creates tag on merge to main)
  execSync(
    `but commit ${branchName} -m "chore: bump v${newVersion}" --changes ${fileIds.join(',')} --status-after`,
    {
      cwd: root,
      stdio: 'inherit',
    },
  );

  console.log(`\nDone. Bumped to v${newVersion}`);
  console.log(`Push the branch and merge to main — CI will tag and publish.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
