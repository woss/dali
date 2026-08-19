/**
 * dali-orm — Type-safe SurrealDB ORM
 *
 * ## Overview
 *
 * dali-orm provides a typed, chainable query-building layer over SurrealDB.
 * Define your schema with `createOrmSchema` / `defineTable`, then use the
 * fluent query builders (`select`, `insert`, `update`, `upsert`, `delete`,
 * `relate`, `live`) to construct and execute type-safe operations.
 *
 * ## Usage
 *
 * 1. **Define a schema** — Use `createOrmSchema()` and `defineTable()` to
 *    declare tables, columns, indexes, events, and access rules.
 * 2. **Connect** — Call `connect(config)` or construct a `DaliORM` instance
 *    with a driver to establish a SurrealDB connection.
 * 3. **Query** — Use the exported builder factories to chain filters, set
 *    data, and call `.execute()` (or `.exec()` on certain builders).
 * 4. **Migrate** — Build and apply schema migrations using the DDL utilities.
 *
 * ## Key Exports
 *
 * | Category | Exports |
 * |----------|---------|
 * | Schema builders | `OrmSchema`, `createOrmSchema`, `defineTable`, `defineFunction`, `defineAccess`, `defineEvent` |
 * | Query builders | `select`, `insert`, `update`, `upsert`, `delete`, `relate`, `live` |
 * | Condition expressions | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `and`, `or`, `not`, `eeq` |
 * | SDK & connection | `DaliORM`, `connect`, `SurrealDriver` |
 * | Migration utilities | Migration DDL types (`EventDefinition`) |
 * | Types | `TableDefinition`, `ColumnDefinition`, `ColumnRef`, `InferSelectResult`, `InferInsertInput`, `InferUpdateInput`, and more |
 *
 * @packageDocumentation
 */
export type { EventDefinition } from './migration/ddl/schemas.js';
export type { DaliORMConfig } from './sdk/dali-orm.js';
export { DaliORM } from './sdk/dali-orm.js';
export type { SchemaBuilder } from './sdk/schema-builder.js';
export { createSchemaBuilder } from './sdk/schema-builder.js';
export { connect } from './sdk/driver/orm-connection.js';
export type { LiveAction, LiveMessageData, LiveQueryOptions, LiveSubscriptionHandle, SurrealDriver, } from './sdk/driver/types.js';
export type { OrmSchemaConfig } from './sdk/orm-schema.js';
export { createOrmSchema, OrmSchema } from './sdk/orm-schema.js';
export type { ColumnDefinition } from './sdk/schema/column/types.js';
export type { FunctionBuilder } from './sdk/schema/function-builder.js';
export { defineFunction } from './sdk/schema/function-builder.js';
export type { AccessConfig, AccessType, EventConfig, FunctionConfig } from './sdk/schema.js';
export { defineAccess, defineEvent } from './sdk/schema.js';
export type { AnalyzerDefinition, IndexDefinition, TableDefinition } from './sdk/table.js';
export { escapeIdent, escapeString, formatDefault, isRaw, quoteString, raw, serializePermissionsFragment, serializeValue, surql, } from './core/surql.js';
export type { RawSurql } from './core/surql.js';
export { ConnectionError, DaliOrmError, MigrationError, QueryError, SchemaError, } from './core/errors.js';
//# sourceMappingURL=index.d.ts.map