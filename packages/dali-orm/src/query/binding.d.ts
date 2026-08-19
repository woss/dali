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
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import { DeleteBuilder } from './delete.js';
import { InsertBuilder } from './insert.js';
import { type RelateBuilder } from './relate.js';
import { SelectBuilder } from './select.js';
import { UpdateBuilder } from './update.js';
/**
 * A TableDefinition extended with builder factory methods.
 *
 * Provides `.select()`, `.insert()`, `.update()`, and `.delete()` methods
 * that create bound query builders for the table.
 */
export type TableBinding<TDef extends TableDefinition> = TDef & {
    /** Create a bound SelectBuilder */
    select(orm: DaliORM): SelectBuilder<TDef>;
    /** Create a bound InsertBuilder */
    insert(orm: DaliORM): InsertBuilder<TDef>;
    /** Create a bound UpdateBuilder */
    update(orm: DaliORM): UpdateBuilder<TDef>;
    /** Create a bound DeleteBuilder */
    delete(orm: DaliORM): DeleteBuilder<TDef>;
    /** Create a bound RelateBuilder (only meaningful for relation tables) */
    relate(orm: DaliORM): RelateBuilder<TDef>;
};
/**
 * Enhance a TableDefinition with builder factory methods.
 *
 * Returns a new object (does NOT mutate the input) with `.select()`, `.insert()`,
 * `.update()`, `.delete()`, and `.relate()` methods added.
 *
 * @param tableDef - The table definition to enhance
 * @returns A new object typed with builder methods
 */
export declare function bindTable<TDef extends TableDefinition>(tableDef: TDef): TableBinding<TDef>;
//# sourceMappingURL=binding.d.ts.map