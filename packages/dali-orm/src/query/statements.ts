/**
 * Statement Query Builders
 *
 * SurrealDB statement builders that are NOT table-specific.
 * These take `orm: DaliORM` in the constructor (no TableDefinition).
 * Some wrap driver methods, others build raw SQL strings.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { DaliORM } from '../sdk/dali-orm.js';

// ============================================================================
// Types
// ============================================================================

/** Scope for INFO builder (DB, NS, or TABLE <name>) */
export type InfoScope = 'DB' | 'NS' | `TABLE ${string}`;

// ============================================================================
// 1. KillBuilder
// ============================================================================

/**
 * Kill a live query subscription.
 * Wraps `driver.kill(subscriptionId)`.
 */
export class KillBuilder {
  private readonly driver: SurrealDriver;
  private subscriptionId?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the subscription ID to kill */
  id(subscriptionId: string): this {
    this.subscriptionId = subscriptionId;
    return this;
  }

  /** Execute the KILL */
  async execute(): Promise<void> {
    if (!this.subscriptionId) {
      throw new Error('Subscription ID is required — use .id()');
    }
    await this.driver.kill(this.subscriptionId);
  }
}

// ============================================================================
// 2. RebuildIndexBuilder
// ============================================================================

/**
 * Rebuild a table index.
 * Builds raw SQL: `REBUILD INDEX {name} ON {table}`.
 */
export class RebuildIndexBuilder {
  private readonly driver: SurrealDriver;
  private indexName?: string;
  private tableName?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the index name to rebuild */
  name(idxName: string): this {
    this.indexName = idxName;
    return this;
  }

  /** Set the table the index belongs to */
  on(tableName: string): this {
    this.tableName = tableName;
    return this;
  }

  /** Execute the REBUILD INDEX statement */
  async execute(): Promise<unknown[]> {
    if (!this.indexName) {
      throw new Error('Index name is required — use .name()');
    }
    if (!this.tableName) {
      throw new Error('Table name is required — use .on()');
    }

    const sql = `REBUILD INDEX ${this.indexName} ON ${this.tableName}`;
    return this.driver.query<unknown>(sql);
  }
}

// ============================================================================
// 3. InfoBuilder
// ============================================================================

/**
 * Query database information.
 * Builds raw SQL: `INFO FOR {scope}`.
 */
export class InfoBuilder {
  private readonly driver: SurrealDriver;
  private scope?: InfoScope;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the scope (e.g., 'DB', 'NS', 'TABLE user') */
  forScope(scope: InfoScope): this {
    this.scope = scope;
    return this;
  }

  /** Execute the INFO FOR statement */
  async execute(): Promise<unknown[]> {
    if (!this.scope) {
      throw new Error('Scope is required — use .forScope()');
    }

    const sql = `INFO FOR ${this.scope}`;
    return this.driver.query<unknown>(sql);
  }
}

// ============================================================================
// 4. ShowChangesBuilder
// ============================================================================

/**
 * Show changes for a table since a given point.
 * Wraps `driver.showChanges(table, options)`.
 */
export class ShowChangesBuilder {
  private readonly driver: SurrealDriver;
  private tableName?: string;
  private sinceValue?: string | number;
  private limitValue?: number;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the table to show changes for */
  table(tableName: string): this {
    this.tableName = tableName;
    return this;
  }

  /** Only show changes since this timestamp or change ID */
  since(value: string | number): this {
    this.sinceValue = value;
    return this;
  }

  /** Limit the number of changes returned */
  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  /** Execute the SHOW CHANGES */
  async execute<T = unknown>(): Promise<T[]> {
    if (!this.tableName) {
      throw new Error('Table name is required — use .table()');
    }

    return this.driver.showChanges<T>(this.tableName, {
      since: this.sinceValue,
      limit: this.limitValue,
    });
  }
}

// ============================================================================
// 5. UseBuilder
// ============================================================================

/**
 * Switch to a different namespace and database.
 * Wraps `driver.use(namespace, database)`.
 */
export class UseBuilder {
  private readonly driver: SurrealDriver;
  private ns?: string;
  private db?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the namespace to use */
  namespace(ns: string): this {
    this.ns = ns;
    return this;
  }

  /** Set the database to use */
  database(db: string): this {
    this.db = db;
    return this;
  }

  /** Execute the USE */
  async execute(): Promise<void> {
    if (!this.ns) {
      throw new Error('Namespace is required — use .namespace()');
    }
    if (!this.db) {
      throw new Error('Database is required — use .database()');
    }

    await this.driver.use(this.ns, this.db);
  }
}

// ============================================================================
// 6. BeginBuilder
// ============================================================================

/**
 * Begin a new transaction.
 * Executes raw SQL: `BEGIN TRANSACTION`.
 */
export class BeginBuilder {
  private readonly driver: SurrealDriver;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Execute the BEGIN TRANSACTION statement */
  async execute(): Promise<void> {
    await this.driver.query('BEGIN TRANSACTION');
  }
}

// ============================================================================
// 7. CommitBuilder
// ============================================================================

/**
 * Commit the current transaction.
 * Executes raw SQL: `COMMIT TRANSACTION`.
 */
export class CommitBuilder {
  private readonly driver: SurrealDriver;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Execute the COMMIT TRANSACTION statement */
  async execute(): Promise<void> {
    await this.driver.query('COMMIT TRANSACTION');
  }
}

// ============================================================================
// 8. CancelBuilder
// ============================================================================

/**
 * Cancel (roll back) the current transaction.
 * SurrealDB uses `CANCEL TRANSACTION` (not `ROLLBACK`).
 * Executes raw SQL: `CANCEL TRANSACTION`.
 */
export class CancelBuilder {
  private readonly driver: SurrealDriver;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Execute the CANCEL TRANSACTION statement */
  async execute(): Promise<void> {
    await this.driver.query('CANCEL TRANSACTION');
  }
}

// ============================================================================
// 9. LetBuilder
// ============================================================================

/**
 * Set a SurrealQL variable.
 * Builds SQL: `LET $varName = $v` using binder parameters.
 */
export class LetBuilder {
  private readonly driver: SurrealDriver;
  private varName?: string;
  private val?: unknown;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the variable name (without $ prefix) */
  name(varName: string): this {
    this.varName = varName;
    return this;
  }

  /** Set the variable value */
  value(val: unknown): this {
    this.val = val;
    return this;
  }

  /** Execute the LET statement */
  async execute(): Promise<unknown[]> {
    if (!this.varName) {
      throw new Error('Variable name is required — use .name()');
    }
    if (this.val === undefined) {
      throw new Error('Variable value is required — use .value()');
    }

    const sql = `LET $${this.varName} = $v`;
    return this.driver.query<unknown>(sql, { v: this.val });
  }
}

// ============================================================================
// 10. ReturnBuilder
// ============================================================================

/**
 * Return a value or expression from a SurrealQL query.
 * Supports value mode (binder param) and raw mode (expression interpolation).
 */
export class ReturnBuilder {
  private readonly driver: SurrealDriver;
  private val?: unknown;
  private rawExpr?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the value to return (binder parameter) */
  value(val: unknown): this {
    this.val = val;
    this.rawExpr = undefined;
    return this;
  }

  /** Set raw expression to return (interpolated directly — use with caution) */
  raw(expr: string): this {
    this.rawExpr = expr;
    this.val = undefined;
    return this;
  }

  /** Execute the RETURN statement */
  async execute(): Promise<unknown[]> {
    if (this.val !== undefined) {
      return this.driver.query<unknown>('RETURN $val', { val: this.val });
    }
    if (this.rawExpr !== undefined) {
      return this.driver.query<unknown>(`RETURN ${this.rawExpr}`, {});
    }
    throw new Error('Value or raw expression is required — use .value() or .raw()');
  }
}

// ============================================================================
// 11. ThrowBuilder
// ============================================================================

/**
 * Throw a custom error in SurrealQL.
 * Supports message mode (binder param) and raw mode (expression interpolation).
 */
export class ThrowBuilder {
  private readonly driver: SurrealDriver;
  private msg?: string;
  private rawExpr?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the error message */
  message(msg: string): this {
    this.msg = msg;
    this.rawExpr = undefined;
    return this;
  }

  /** Set raw expression to throw (interpolated directly — use with caution) */
  raw(expr: string): this {
    this.rawExpr = expr;
    this.msg = undefined;
    return this;
  }

  /** Execute the THROW statement */
  async execute(): Promise<unknown[]> {
    if (this.msg !== undefined) {
      return this.driver.query<unknown>('THROW $msg', { msg: this.msg });
    }
    if (this.rawExpr !== undefined) {
      return this.driver.query<unknown>(`THROW ${this.rawExpr}`, {});
    }
    throw new Error('Message or raw expression is required — use .message() or .raw()');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function kill(orm: DaliORM): KillBuilder {
  return new KillBuilder(orm);
}

export function rebuildIndex(orm: DaliORM): RebuildIndexBuilder {
  return new RebuildIndexBuilder(orm);
}

export function info(orm: DaliORM): InfoBuilder {
  return new InfoBuilder(orm);
}

export function showChanges(orm: DaliORM): ShowChangesBuilder {
  return new ShowChangesBuilder(orm);
}

export function use(orm: DaliORM): UseBuilder {
  return new UseBuilder(orm);
}

export function beginTransaction(orm: DaliORM): BeginBuilder {
  return new BeginBuilder(orm);
}

export function commitTransaction(orm: DaliORM): CommitBuilder {
  return new CommitBuilder(orm);
}

export function cancelTransaction(orm: DaliORM): CancelBuilder {
  return new CancelBuilder(orm);
}

export function let_(orm: DaliORM): LetBuilder {
  return new LetBuilder(orm);
}

export function return_(orm: DaliORM): ReturnBuilder {
  return new ReturnBuilder(orm);
}

export function throw_(orm: DaliORM): ThrowBuilder {
  return new ThrowBuilder(orm);
}

// ============================================================================
// 12. DefineParamBuilder
// ============================================================================

/**
 * Define a SurrealQL parameter.
 * Builds SQL: `DEFINE PARAM $name VALUE $v [TYPE ...] [PERMISSIONS ...]`.
 */
export class DefineParamBuilder {
  private readonly driver: SurrealDriver;
  private paramName?: string;
  private paramValue?: unknown;
  private paramType?: string;
  private perms?: string;

  constructor(orm: DaliORM) {
    if (!orm) throw new Error('DaliORM instance is required');
    this.driver = orm.getDriver();
  }

  /** Set the parameter name (without $ prefix — builder adds it) */
  name(name: string): this {
    this.paramName = name;
    return this;
  }

  /** Set the parameter's default value */
  value(val: unknown): this {
    this.paramValue = val;
    return this;
  }

  /** Set the parameter type (e.g., 'string', 'int', 'float', 'decimal') */
  type(typeStr: string): this {
    this.paramType = typeStr;
    return this;
  }

  /** Set PERMISSIONS clause */
  permissions(perms: string): this {
    this.perms = perms;
    return this;
  }

  /** Execute the DEFINE PARAM statement */
  async execute(): Promise<unknown[]> {
    if (!this.paramName) {
      throw new Error('Parameter name is required — use .name()');
    }
    if (this.paramValue === undefined) {
      throw new Error('Parameter value is required — use .value()');
    }

    let sql = `DEFINE PARAM $${this.paramName} VALUE $v`;
    if (this.paramType) {
      sql += ` TYPE ${this.paramType}`;
    }
    if (this.perms) {
      sql += ` PERMISSIONS ${this.perms}`;
    }
    return this.driver.query<unknown>(sql, { v: this.paramValue });
  }
}

export function defineParam(orm: DaliORM): DefineParamBuilder {
  return new DefineParamBuilder(orm);
}
