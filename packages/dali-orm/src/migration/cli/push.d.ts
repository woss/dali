import type { SurrealDriver } from '../../sdk/driver/types.js';
import type {
  AccessConfig,
  EventConfig,
  FunctionConfig,
} from '../../sdk/schema.js';
import type { TableDefinition } from '../../sdk/table.js';
import type { Config } from '../config.js';
import { type SurrealDbDDL } from '../ddl/ddl.js';
export interface PushOptions {
  config: Config;
  tables: TableDefinition[];
  access?: AccessConfig[];
  events?: EventConfig[];
  functions?: FunctionConfig[];
  dryRun?: boolean;
  force?: boolean;
  embeddedDriver?: boolean;
}
/**
 * Convert TableDefinition[] to SurrealDbDDL format
 */
export declare function tablesToDdl(
  tables: TableDefinition[],
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
): SurrealDbDDL;
/**
 * Push schema changes to database
 */
export declare function pushSchema(
  options: PushOptions,
  driver?: SurrealDriver,
): Promise<void>;
//# sourceMappingURL=push.d.ts.map
