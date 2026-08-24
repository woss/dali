import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { TableDefinition } from '../../sdk/table.js';
import type { Config } from '../config.js';
export interface DiffOptions {
  config: Config;
  tables: TableDefinition[];
  verbose?: boolean;
}
/**
 * Show schema diff between database and schema files
 */
export declare function diffSchema(
  options: DiffOptions,
  driver?: SurrealDriver,
): Promise<void>;
//# sourceMappingURL=diff.d.ts.map
