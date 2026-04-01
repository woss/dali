/**
 * Shared CLI operations for DaliORM CLI commands.
 * Centralizes connection, disconnect, error handling, and display patterns
 * that repeat across all CLI command files.
 */
import { connect } from '../../sdk/driver/orm-connection.js';
import type { Config } from '../config.js';
import type { SurrealDriver } from '../../sdk/driver/types.js';

// ============================================================================
// Connection helpers
// ============================================================================

/**
 * Create a driver connection from config.
 * Uses embedded driver when embeddedDriver=true, otherwise node driver.
 *
 * Replaces 11 instances of identical connect() {embeddedDriver ? ... : ...} blocks.
 */
export async function createConnection(
  config: Config,
  embeddedDriver?: boolean,
): Promise<SurrealDriver> {
  return connect(
    embeddedDriver
      ? {
          embeddedDriver: {
            driver: 'embedded',
            namespace: config.namespace,
            database: config.database,
          },
        }
      : {
          nodeDriver: {
            driver: 'node',
            url: config.url,
            namespace: config.namespace,
            database: config.database,
            auth: config.auth,
          },
        },
  );
}

/**
 * Create connection with timeout race.
 * Replaces the connectionTimeout pattern in cli.ts handleGenerate and migrate.ts migrateDev.
 */
export async function createConnectionWithTimeout(
  config: Config,
  timeoutMs = 5000,
): Promise<SurrealDriver> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Connection timeout (${timeoutMs / 1000}s)`)), timeoutMs);
  });
  return Promise.race([createConnection(config), timeout]);
}

/**
 * Safe disconnect: logs non-fatal error instead of throwing.
 * Replaces 15 instances of try { await driver.disconnect(); } catch (e) { console.log(...) }
 */
export async function safeDisconnect(driver?: SurrealDriver): Promise<void> {
  if (!driver) return;
  try {
    await driver.disconnect();
  } catch (error) {
    console.log(
      'Disconnect error (non-fatal):',
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ============================================================================
// Error formatting
// ============================================================================

/** Format any error to string */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ============================================================================
// Display helpers (shared patterns from push.ts/diff.ts)
// ============================================================================

type GroupedMap = Record<string, Array<unknown>>;

/**
 * Extract names from a grouped statement category.
 * Each extracted item supports:
 * - item.name (for simple name extraction)
 * - item.index?.name (for create_index)
 * - item.access?.name (for create_access)
 * - item.event?.name (for create_event)
 * - item.function?.name (for create_function)
 * - item.table (for table context)
 */
function extractNames(grouped: GroupedMap, category: string): string[] {
  const items = (grouped[category] || []) as Array<Record<string, unknown>>;
  return items
    .map((s) => {
      const idx = s as { index?: { name?: string } };
      if (typeof idx?.index?.name === 'string') return idx.index.name;
      const access = s as { access?: { name?: string } };
      if (typeof access?.access?.name === 'string') return access.access.name;
      const event = s as { event?: { name?: string } };
      if (typeof event?.event?.name === 'string') return event.event.name;
      const fn = s as { function?: { name?: string } };
      if (typeof fn?.function?.name === 'string') return fn.function.name;
      const hasName = s as { name?: string };
      if (typeof hasName?.name === 'string') return hasName.name;
      return '';
    })
    .filter(Boolean);
}

/** Print an "Added X (N):" block with + items */
export function printAddedSection(grouped: GroupedMap, category: string, label: string): void {
  const names = extractNames(grouped, category);
  if (names.length > 0) {
    console.log(`Added ${label} (${names.length}):`);
    for (const name of names) {
      console.log(`  + ${name}`);
    }
    console.log();
  }
}

/** Print a "Removed X (N):" block with - items */
export function printRemovedSection(grouped: GroupedMap, category: string, label: string): void {
  const names = extractNames(grouped, category);
  if (names.length > 0) {
    console.log(`Removed ${label} (${names.length}):`);
    for (const name of names) {
      console.log(`  - ${name}`);
    }
    console.log();
  }
}

/** Print warnings section */
export function printWarnings(warnings: string[]): void {
  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of warnings) {
      console.log(`  \u26a0 ${warning}`);
    }
    console.log();
  }
}
