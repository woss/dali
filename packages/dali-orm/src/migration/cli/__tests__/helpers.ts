/**
 * Shared test utilities for CLI command tests.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { vi } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import type { Config } from '../../config.js';
// Import the EmbeddedConfig type for driver construction
import type { EmbeddedConfig } from '../../../sdk/driver/types.js';

let counter = 0;

/** Create fresh embedded driver with unique ns/db */
export function createTestDriver(
  mode: 'memory' | 'surrealkv' = 'memory',
  dbPath?: string,
): EmbeddedDriver {
  counter++;
  const config: EmbeddedConfig = {
    driver: 'embedded',
    namespace: 'cli_test_ns',
    database: `cli_test_db_${Date.now()}_${counter}`,
    mode,
    ...(dbPath ? { path: dbPath } : {}),
  };
  return new EmbeddedDriver(config);
}

/** Create temp directory, return path */
export async function createTempDir(prefix: string = 'cli-test'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

/** Clean up temp directory */
export async function cleanupDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Minimal valid Config for embedded driver testing */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    url: '',
    namespace: 'test_ns',
    database: 'test_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
    migrations: {
      dir: './migrations',
      table: '__migrations',
    },
    ...overrides,
  } as Config;
}

/** Create a migration surql file in dir with timestamp + name */
export async function createMigrationFile(
  dir: string,
  name: string,
  upStatements: string[],
): Promise<string> {
  const timestamp = Date.now().toString();
  const migrationDir = path.join(dir, `${timestamp}_${name}`);
  const filePath = path.join(migrationDir, 'migration.surql');
  await fs.mkdir(migrationDir, { recursive: true });
  const content = [
    `-- Migration: ${name}`,
    `-- Version: ${timestamp}`,
    '',
    '-- UP',
    ...upStatements.map((s) => `${s};`),
  ].join('\n');
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/** Mock console.log and console.error, returning restore function */
export function mockConsole(): () => void {
  const origLog = console.log;
  const origErr = console.error;
  console.log = vi.fn();
  console.error = vi.fn();
  return () => {
    console.log = origLog;
    console.error = origErr;
  };
}

/** Mock process.exit, returning restore function */
export function mockProcessExit(): () => void {
  const origExit = process.exit.bind(process);
  (process as any).exit = vi.fn();
  return () => {
    (process as any).exit = origExit;
  };
}

/** Create schema.ts file content for testing generate/diff */
export function createSchemaFileContent(
  tables: Array<{ name: string; columns: Array<{ name: string; type: string }> }>,
): string {
  const imports = [
    'import { defineTable } from "@woss/dali-orm/sdk/table";',
    'import { string } from "@woss/dali-orm/sdk/schema/column/simple-builders";',
  ];
  const tableDefs = tables.map((t) => {
    const cols = t.columns.map((c) => `  ${c.name}: string('${c.name}'),`).join('\n');
    return `export const ${t.name}Schema = defineTable('${t.name}', {\n${cols}\n});`;
  });
  const exports = `export default {\n  ${tables.map((t) => `${t.name}: ${t.name}Schema`).join(',\n  ')}\n};`;
  return [...imports, '', ...tableDefs, '', exports, ''].join('\n');
}
