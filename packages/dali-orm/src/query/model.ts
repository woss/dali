import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import { SelectBuilder } from './select.js';
import { InsertBuilder } from './insert.js';
import { UpdateBuilder } from './update.js';
import { DeleteBuilder } from './delete.js';
import { relate } from './relate.js';
import type { RelateBuilder } from './relate.js';
import { CreateBuilder } from './create.js';
import { UpsertBuilder } from './upsert.js';
import { LiveQueryBuilder } from './live.js';
import type { CreateBuilder as CreateBuilderType } from './create.js';
import type { UpsertBuilder as UpsertBuilderType } from './upsert.js';
import type { LiveQueryBuilder as LiveQueryBuilderType } from './live.js';

/**
 * Model class that captures a DaliORM instance + TableDefinition
 * so users can chain builder methods without passing `orm` on every call.
 *
 * @typeParam TDef - The table definition type, must extend TableDefinition.
 */
export class Model<TDef extends TableDefinition> {
  constructor(
    private readonly _orm: DaliORM,
    private readonly tableDef: TDef,
  ) {}

  /**
   * Create a new SelectBuilder bound to the stored ORM and table definition.
   */
  select(): SelectBuilder<TDef> {
    return new SelectBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new InsertBuilder bound to the stored ORM and table definition.
   */
  insert(): InsertBuilder<TDef> {
    return new InsertBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new UpdateBuilder bound to the stored ORM and table definition.
   */
  update(): UpdateBuilder<TDef> {
    return new UpdateBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new DeleteBuilder bound to the stored ORM and table definition.
   */
  delete(): DeleteBuilder<TDef> {
    return new DeleteBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new RelateBuilder bound to the stored ORM and table definition.
   */
  relate(): RelateBuilder<TDef> {
    return relate(this._orm, this.tableDef);
  }

  /**
   * Create a new CreateBuilder bound to the stored ORM and table definition.
   */
  create(): CreateBuilderType<TDef> {
    return new CreateBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new UpsertBuilder bound to the stored ORM and table definition.
   */
  upsert(): UpsertBuilderType<TDef> {
    return new UpsertBuilder(this._orm, this.tableDef);
  }

  /**
   * Create a new LiveQueryBuilder bound to the stored ORM and table definition.
   */
  live(): LiveQueryBuilderType<TDef> {
    return new LiveQueryBuilder(this._orm, this.tableDef);
  }

  /**
   * Get the underlying DaliORM instance for raw ORM operations.
   */
  get orm(): DaliORM {
    return this._orm;
  }
}

/**
 * Factory function that wraps `new Model(orm, tableDef)`.
 *
 * @typeParam TDef - The table definition type, must extend TableDefinition.
 * @param orm - The DaliORM instance.
 * @param tableDef - The table definition.
 * @returns A new Model instance bound to the given ORM and table definition.
 */
export function createModel<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): Model<TDef> {
  return new Model(orm, tableDef);
}
