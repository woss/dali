import type { EmbeddedConfig, SurrealDriver } from '../../sdk/driver/types.js';
import type { SurrealColumnType } from '../../sdk/schema/column/types.js';
import type { Config } from '../config.js';
export interface PullOptions {
  config: Config;
  outputDir?: string;
  table?: string;
  embeddedDriver?: boolean;
  /** Embedded driver configuration (mode, path) - fixes memory-only default */
  embeddedConfig?: EmbeddedConfig;
}
export declare function pullSchema(
  options: PullOptions,
  driver?: SurrealDriver,
): Promise<void>;
export declare function generateColumnDefinition(column: {
  name: string;
  kind?: SurrealColumnType;
  optional?: boolean;
  default?: unknown;
  defaultRaw?: string;
  flexible?: boolean;
  readonly?: boolean;
  recordTable?: string;
}): string;
//# sourceMappingURL=pull.d.ts.map
