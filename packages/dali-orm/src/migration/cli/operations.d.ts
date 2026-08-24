import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { Config } from '../config.js';
/**
 * Create a driver connection from config.
 * Uses embedded driver when embeddedDriver=true, otherwise node driver.
 *
 * Replaces 11 instances of identical connect() {embeddedDriver ? ... : ...} blocks.
 */
export declare function createConnection(
  config: Config,
  embeddedDriver?: boolean,
): Promise<SurrealDriver>;
/**
 * Create connection with timeout race.
 * Replaces the connectionTimeout pattern in cli.ts handleGenerate and migrate.ts migrateDev.
 */
export declare function createConnectionWithTimeout(
  config: Config,
  timeoutMs?: number,
): Promise<SurrealDriver>;
/**
 * Safe disconnect: logs non-fatal error instead of throwing.
 * Replaces 15 instances of try { await driver.disconnect(); } catch (e) { console.log(...) }
 */
export declare function safeDisconnect(driver?: SurrealDriver): Promise<void>;
/** Format any error to string */
export declare function formatError(error: unknown): string;
type GroupedMap = Record<string, Array<unknown>>;
/** Print an "Added X (N):" block with + items */
export declare function printAddedSection(
  grouped: GroupedMap,
  category: string,
  label: string,
): void;
/** Print a "Removed X (N):" block with - items */
export declare function printRemovedSection(
  grouped: GroupedMap,
  category: string,
  label: string,
): void;
/** Print warnings section */
export declare function printWarnings(warnings: string[]): void;
//# sourceMappingURL=operations.d.ts.map
