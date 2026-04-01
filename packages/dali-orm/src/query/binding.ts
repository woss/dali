/**
 * Table Binding
 *
 * Enhances a TableDefinition with builder factory methods (select, insert, update, delete).
 * Avoids circular dependencies by being a separate module that imports from both
 * sdk/table.ts and the query builder modules.
 *
 * @example
 * ```typescript
 * import { defineTable, string, int } from '@woss/dali-orm';
 * import { bindTable } from '@woss/dali-orm/query';
 *
 * const users = defineTable('user', { name: string(), age: int() });
 * const table = bindTable(users);
 *
 * // Builder methods are now available on the table:
 * const results = await table.select(driver)
 *   .where((w) => w.eq('name', 'Alice'))
 *   .execute();
 * ```
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import { DeleteBuilder } from './delete.js';
import { InsertBuilder } from './insert.js';
import { type RelateBuilder, relate as relateFactory } from './relate.js';
import { SelectBuilder } from './select.js';
import { UpdateBuilder } from './update.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A TableDefinition extended with builder factory methods.
 *
 * Provides `.select()`, `.insert()`, `.update()`, and `.delete()` methods
 * that create bound query builders for the table.
 */
export type TableBinding<TDef extends TableDefinition> = TDef & {
  /** Create a bound SelectBuilder */
  select(driver: SurrealDriver): SelectBuilder<TDef>;
  /** Create a bound InsertBuilder */
  insert(driver: SurrealDriver): InsertBuilder<TDef>;
  /** Create a bound UpdateBuilder */
  update(driver: SurrealDriver): UpdateBuilder<TDef>;
  /** Create a bound DeleteBuilder */
  delete(driver: SurrealDriver): DeleteBuilder<TDef>;
  /** Create a bound RelateBuilder (only meaningful for relation tables) */
  relate(driver: SurrealDriver): RelateBuilder<TDef>;
};

// ============================================================================
// Factory
// ============================================================================

/**
 * Enhance a TableDefinition with builder factory methods.
 *
 * Mutates the table definition object by adding `.select()`, `.insert()`,
 * `.update()`, and `.delete()` methods, then returns it typed as a TableBinding.
 *
 * @param tableDef - The table definition to enhance
 * @returns The same object typed with builder methods
 */
export function bindTable<TDef extends TableDefinition>(tableDef: TDef): TableBinding<TDef> {
  const binding = tableDef as unknown as TableBinding<TDef>;

  binding.select = (driver: SurrealDriver) => new SelectBuilder(driver, tableDef);
  binding.insert = (driver: SurrealDriver) => new InsertBuilder(driver, tableDef);
  binding.update = (driver: SurrealDriver) => new UpdateBuilder(driver, tableDef);
  binding.delete = (driver: SurrealDriver) => new DeleteBuilder(driver, tableDef);
  binding.relate = (driver: SurrealDriver) => relateFactory(driver, tableDef);

  return binding;
}
