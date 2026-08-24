import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { CreateBuilder as CreateBuilderType } from './create.js';
import { DeleteBuilder } from './delete.js';
import { InsertBuilder } from './insert.js';
import type { LiveQueryBuilder as LiveQueryBuilderType } from './live.js';
import type { RelateBuilder } from './relate.js';
import { SelectBuilder } from './select.js';
import { UpdateBuilder } from './update.js';
import type { UpsertBuilder as UpsertBuilderType } from './upsert.js';
/**
 * Model class that captures a DaliORM instance + TableDefinition
 * so users can chain builder methods without passing `orm` on every call.
 *
 * @typeParam TDef - The table definition type, must extend TableDefinition.
 */
export declare class Model<TDef extends TableDefinition> {
  private readonly _orm;
  private readonly tableDef;
  constructor(_orm: DaliORM, tableDef: TDef);
  /**
   * Create a new SelectBuilder bound to the stored ORM and table definition.
   */
  select(): SelectBuilder<TDef>;
  /**
   * Create a new InsertBuilder bound to the stored ORM and table definition.
   */
  insert(): InsertBuilder<TDef>;
  /**
   * Create a new UpdateBuilder bound to the stored ORM and table definition.
   */
  update(): UpdateBuilder<TDef>;
  /**
   * Create a new DeleteBuilder bound to the stored ORM and table definition.
   */
  delete(): DeleteBuilder<TDef>;
  /**
   * Create a new RelateBuilder bound to the stored ORM and table definition.
   */
  relate(): RelateBuilder<TDef>;
  /**
   * Create a new CreateBuilder bound to the stored ORM and table definition.
   */
  create(): CreateBuilderType<TDef>;
  /**
   * Create a new UpsertBuilder bound to the stored ORM and table definition.
   */
  upsert(): UpsertBuilderType<TDef>;
  /**
   * Create a new LiveQueryBuilder bound to the stored ORM and table definition.
   */
  live(): LiveQueryBuilderType<TDef>;
  /**
   * Get the underlying DaliORM instance for raw ORM operations.
   */
  get orm(): DaliORM;
}
/**
 * Factory function that wraps `new Model(orm, tableDef)`.
 *
 * @typeParam TDef - The table definition type, must extend TableDefinition.
 * @param orm - The DaliORM instance.
 * @param tableDef - The table definition.
 * @returns A new Model instance bound to the given ORM and table definition.
 */
export declare function createModel<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): Model<TDef>;
//# sourceMappingURL=model.d.ts.map
