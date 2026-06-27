// Main entry point for dali-orm

export type { EventDefinition } from './migration/ddl/schemas.js';
export type { DaliORMConfig } from './sdk/dali-orm.js';
export { DaliORM } from './sdk/dali-orm.js';
export { connect } from './sdk/driver/orm-connection.js';
export type {
  LiveAction,
  LiveMessageData,
  LiveQueryOptions,
  LiveSubscriptionHandle,
  SurrealDriver,
} from './sdk/driver/types.js';
export type { OrmSchemaConfig } from './sdk/orm-schema.js';
// OrmSchema - Schema definition container
export { createOrmSchema, OrmSchema } from './sdk/orm-schema.js';
export type { ColumnDefinition } from './sdk/schema/column/types.js';
export type { FunctionBuilder } from './sdk/schema/function-builder.js';
export { defineFunction } from './sdk/schema/function-builder.js';
// Access config types
// Function definition types
export type { AccessConfig, AccessType, FunctionConfig } from './sdk/schema.js';
export type { AnalyzerDefinition, IndexDefinition, TableDefinition } from './sdk/table.js';
