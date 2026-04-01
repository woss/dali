# Drizzle ORM Table Definition, Types, and IDE Autocomplete Guide

This document provides a comprehensive overview of how Drizzle ORM handles table definitions, the type system, and IDE autocomplete. It's designed to help developers understand the internals and potentially extend them.

---

## Table of Contents

1. [Core Architecture Overview](#1-core-architecture-overview)
2. [Table Definition System](#2-table-definition-system)
3. [Column Type Builders](#3-column-type-builders)
4. [Type System](#4-type-system)
5. [IDE Autocomplete](#5-ide-autocomplete)
6. [Query Building](#6-query-building)
7. [Relations](#7-relations)
8. [Database Adapter Differences](#8-database-adapter-differences)
9. [Type Flow Diagrams](#9-type-flow-diagrams)
10. [Gotchas and Edge Cases](#10-gotchas-and-edge-cases)

---

## 1. Core Architecture Overview

### Entity Kind Pattern

Drizzle uses a runtime type identification system called the **entityKind** pattern.

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/entity.ts` (Lines 1-42)

```typescript
// The entityKind symbol is used as a unique identifier for Drizzle entities
export const entityKind = Symbol.for('drizzle:entityKind');

// Every Drizzle entity (Table, Column, etc.) has an entityKind property
// that identifies its type at runtime
export interface DrizzleEntity {
  [entityKind]: string;
}

// The 'is' function checks if a value is an instance of a Drizzle entity
export function is<T extends DrizzleEntityClass<any>>(
  value: any,
  type: T,
): value is InstanceType<T>;
```

**Usage in Classes:**

```typescript
export class Table<T extends TableConfig = TableConfig> implements SQLWrapper {
  static readonly [entityKind]: string = 'Table';
  // ...
}

export class Column<T extends ColumnBaseConfig = ...> implements ... {
  static readonly [entityKind]: string = 'Column';
  // ...
}
```

This pattern allows Drizzle to:

- Identify entities at runtime without using `instanceof`
- Safely check types across different execution contexts (e.g., across boundaries)
- Maintain type safety while supporting dynamic operations

---

## 2. Table Definition System

### 2.1 Base Table Class

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/table.ts` (Lines 1-208)

The base `Table` class is the foundation for all database adapters.

```typescript
// Table configuration type
export interface TableConfig<TColumn extends Column = Column<any>> {
  name: string; // Database table name
  schema: string | undefined; // Schema name (e.g., 'public' for PostgreSQL)
  columns: Record<string, TColumn>; // All columns defined on the table
  dialect: string; // Database dialect ('pg', 'mysql', 'sqlite')
}

// Core Table class
export class Table<T extends TableConfig = TableConfig> implements SQLWrapper {
  static readonly [entityKind]: string = 'Table';

  // Brand types for compile-time type safety
  declare readonly _: {
    readonly brand: 'Table';
    readonly config: T;
    readonly name: T['name'];
    readonly schema: T['schema'];
    readonly columns: T['columns'];
    readonly inferSelect: InferSelectModel<Table<T>>;
    readonly inferInsert: InferInsertModel<Table<T>>;
  };

  // Shorthand type inference properties
  declare readonly $inferSelect: InferSelectModel<Table<T>>;
  declare readonly $inferInsert: InferInsertModel<Table<T>>;
}
```

### 2.2 PostgreSQL Table (pgTable)

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/table.ts` (Lines 1-252)

```typescript
// PostgreSQL-specific table class
export class PgTable<T extends TableConfig = TableConfig> extends Table<T> {
  static override readonly [entityKind]: string = 'PgTable';

  /** @internal - Stores inline foreign keys */
  [InlineForeignKeys]: ForeignKey[] = [];

  /** @internal - Row-Level Security flag */
  [EnableRLS]: boolean = false;
}

// Type for tables with columns attached (returned by pgTable)
export type PgTableWithColumns<T extends TableConfig> = PgTable<T> & {
  [Key in keyof T['columns']]: T['columns'][Key]; // Columns as direct properties
} & {
  enableRLS: () => Omit<PgTableWithColumns<T>, 'enableRLS'>; // RLS method
};
```

**The `pgTable` function:**

```typescript
export interface PgTableFn<TSchema extends string | undefined = undefined> {
  // Overload 1: Columns as object
  <TTableName extends string, TColumnsMap extends Record<string, PgColumnBuilderBase>>(
    name: TTableName,
    columns: TColumnsMap,
    extraConfig?: (self: ...) => PgTableExtraConfigValue[],
  ): PgTableWithColumns<{
    name: TTableName;
    schema: TSchema;
    columns: BuildColumns<TTableName, TColumnsMap, 'pg'>;  // Key transformation!
    dialect: 'pg';
  }>;

  // Overload 2: Columns as function (with columnTypes helper)
  <TTableName extends string, TColumnsMap extends Record<string, PgColumnBuilderBase>>(
    name: TTableName,
    columns: (columnTypes: PgColumnsBuilders) => TColumnsMap,
    extraConfig?: (self: ...) => PgTableExtraConfigValue[],
  ): PgTableWithColumns<{...}>;
}
```

**Example Usage:**

```typescript
import { pgTable, text, integer, varchar } from 'drizzle-orm/pg-core';

// Simple table
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

// Table with schema and extra config
export const posts = pgTable(
  'posts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    content: text('content'),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
  },
  (t) => ({
    authorIdx: index('author_idx').on(t.authorId),
  }),
);
```

### 2.3 MySQL Table (mysqlTable)

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/mysql-core/table.ts` (Lines 1-229)

```typescript
export class MySqlTable<T extends TableConfig = TableConfig> extends Table<T> {
  static override readonly [entityKind]: string = 'MySqlTable';

  /** @internal */
  [InlineForeignKeys]: ForeignKey[] = [];
}
```

**Key Difference from PostgreSQL:** MySQL tables don't support Row-Level Security (RLS).

### 2.4 SQLite Table (sqliteTable)

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sqlite-core/table.ts` (Lines 1-227)

```typescript
export class SQLiteTable<T extends TableConfig = TableConfig> extends Table<T> {
  static override readonly [entityKind]: string = 'SQLiteTable';

  /** @internal */
  [InlineForeignKeys]: ForeignKey[] = [];
}
```

---

## 3. Column Type Builders

### 3.1 Base Column Builder

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/column-builder.ts` (Lines 1-416)

The `ColumnBuilder` is the base class for all column type builders.

```typescript
// Configuration for column builder
export interface ColumnBuilderBaseConfig<
  TDataType extends ColumnDataType,
  TColumnType extends string,
> {
  name: string;
  dataType: TDataType; // 'string', 'number', 'boolean', 'array', 'json', etc.
  columnType: TColumnType; // 'PgText', 'PgInteger', 'MySqlInt', etc.
  data: unknown; // The TypeScript type of the column
  driverParam: unknown; // The type used in driver parameters
  enumValues: string[] | undefined;
}

// Runtime configuration stored in the builder
export type ColumnBuilderRuntimeConfig<TData, TRuntimeConfig extends object = object> = {
  name: string;
  keyAsName: boolean;
  notNull: boolean;
  default: TData | SQL | undefined;
  defaultFn: (() => TData | SQL) | undefined;
  onUpdateFn: (() => TData | SQL) | undefined;
  hasDefault: boolean;
  primaryKey: boolean;
  isUnique: boolean;
  // ... more fields
};

// Type modifier utilities
export type NotNull<T extends ColumnBuilderBase> = T & {
  _: { notNull: true };
};

export type HasDefault<T extends ColumnBuilderBase> = T & {
  _: { hasDefault: true };
};

export type IsPrimaryKey<T extends ColumnBuilderBase> = T & {
  _: { isPrimaryKey: true };
};

export type $Type<T extends ColumnBuilderBase, TType> = T & {
  _: { $type: TType }; // Custom type override
};
```

### 3.2 PostgreSQL Column Builder

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/columns/common.ts` (Lines 33-133)

```typescript
// PostgreSQL-specific column builder base
export interface PgColumnBuilderBase<
  T extends ColumnBuilderBaseConfig<ColumnDataType, string> = ColumnBuilderBaseConfig<ColumnDataType, string>,
  TTypeConfig extends object = object,
> extends ColumnBuilderBase<T, TTypeConfig & { dialect: 'pg' }> {}

// Abstract base class for PostgreSQL column builders
export abstract class PgColumnBuilder<
  T extends ColumnBuilderBaseConfig<ColumnDataType, string> = ColumnBuilderBaseConfig<ColumnDataType, string>,
  TRuntimeConfig extends object = object,
  TTypeConfig extends object = object,
  TExtraConfig extends ColumnBuilderExtraConfig = ColumnBuilderExtraConfig,
> extends ColumnBuilder<T, TRuntimeConfig, TTypeConfig & { dialect: 'pg' }, TExtraConfig>
  implements PgColumnBuilderBase<T, TTypeConfig>
{
  private foreignKeyConfigs: ReferenceConfig[] = [];

  // PostgreSQL-specific method for array columns
  array<TSize extends number | undefined = undefined>(
    size?: TSize
  ): PgArrayBuilder<...> { ... }

  // Foreign key configuration
  references(
    ref: ReferenceConfig['ref'],
    actions: ReferenceConfig['actions'] = {},
  ): this { ... }

  // Unique constraint
  unique(
    name?: string,
    config?: { nulls: 'distinct' | 'not distinct' },
  ): this { ... }

  // Generated column
  generatedAlwaysAs(as: SQL | T['data'] | (() => SQL)): HasGenerated<this, {...}> { ... }
}
```

### 3.3 Example: Text Column

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/columns/text.ts` (Lines 1-67)

```typescript
// Initial type returned by text() function
export type PgTextBuilderInitial<
  TName extends string,
  TEnum extends [string, ...string[]],
> = PgTextBuilder<{
  name: TName;
  dataType: 'string';
  columnType: 'PgText';
  data: TEnum[number]; // Type is the enum union
  enumValues: TEnum;
  driverParam: string;
}>;

// The builder class
export class PgTextBuilder<
  T extends ColumnBuilderBaseConfig<'string', 'PgText'>,
> extends PgColumnBuilder<T, { enumValues: T['enumValues'] }> {
  static override readonly [entityKind]: string = 'PgTextBuilder';

  constructor(name: T['name'], config: PgTextConfig<T['enumValues']>) {
    super(name, 'string', 'PgText');
    this.config.enumValues = config.enum;
  }

  /** @internal */
  override build<TTableName extends string>(
    table: AnyPgTable<{ name: TTableName }>,
  ): PgText<MakeColumnConfig<T, TTableName>> {
    return new PgText<MakeColumnConfig<T, TTableName>>(
      table,
      this.config as ColumnBuilderRuntimeConfig<any, any>,
    );
  }
}

// The final column type
export class PgText<T extends ColumnBaseConfig<'string', 'PgText'>> extends PgColumn<
  T,
  { enumValues: T['enumValues'] }
> {
  static override readonly [entityKind]: string = 'PgText';

  override readonly enumValues = this.config.enumValues;

  getSQLType(): string {
    return 'text';
  }
}

// Function overloads for flexible API
export function text(): PgTextBuilderInitial<'', [string, ...string[]]>;
export function text<U extends string, T extends Readonly<[U, ...U[]]>>(
  config?: PgTextConfig<T | Writable<T>>,
): PgTextBuilderInitial<'', Writable<T>>;
export function text<TName extends string, U extends string, T extends Readonly<[U, ...U[]]>>(
  name: TName,
  config?: PgTextConfig<T | Writable<T>>,
): PgTextBuilderInitial<TName, Writable<T>>;
export function text(a?: string | PgTextConfig, b: PgTextConfig = {}): any {
  const { name, config } = getColumnNameAndConfig<PgTextConfig>(a, b);
  return new PgTextBuilder(name, config as any);
}
```

### 3.4 Example: Integer Column

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/columns/integer.ts` (Lines 1-53)

```typescript
export type PgIntegerBuilderInitial<TName extends string> = PgIntegerBuilder<{
  name: TName;
  dataType: 'number';
  columnType: 'PgInteger';
  data: number;
  driverParam: number | string;
  enumValues: undefined;
}>;

export class PgIntegerBuilder<
  T extends ColumnBuilderBaseConfig<'number', 'PgInteger'>,
> extends PgIntColumnBaseBuilder<T> {
  // Uses common integer base
  static override readonly [entityKind]: string = 'PgIntegerBuilder';

  constructor(name: T['name']) {
    super(name, 'number', 'PgInteger');
  }

  override build<TTableName extends string>(
    table: AnyPgTable<{ name: TTableName }>,
  ): PgInteger<MakeColumnConfig<T, TTableName>> {
    return new PgInteger<MakeColumnConfig<T, TTableName>>(
      table,
      this.config as ColumnBuilderRuntimeConfig<any, any>,
    );
  }
}

export class PgInteger<T extends ColumnBaseConfig<'number', 'PgInteger'>> extends PgColumn<T> {
  static override readonly [entityKind]: string = 'PgInteger';

  getSQLType(): string {
    return 'integer';
  }

  override mapFromDriverValue(value: number | string): number {
    if (typeof value === 'string') {
      return Number.parseInt(value);
    }
    return value;
  }
}

export function integer(): PgIntegerBuilderInitial<''>;
export function integer<TName extends string>(name: TName): PgIntegerBuilderInitial<TName>;
export function integer(name?: string) {
  return new PgIntegerBuilder(name ?? '');
}
```

### 3.5 Column Builder Modifier Methods

All column builders support these chainable methods:

```typescript
// 1. notNull() - Makes column required
.notNull(): NotNull<this>

// 2. default(value) - Sets a default value
.default(value: T['data'] | SQL): HasDefault<this>

// 3. $defaultFn(fn) - Dynamic default function
.$defaultFn(fn: () => T['data'] | SQL): HasRuntimeDefault<HasDefault<this>>

// 4. $onUpdateFn(fn) - Dynamic update function
.$onUpdateFn(fn: () => T['data'] | SQL): HasDefault<this>

// 5. primaryKey() - Sets as primary key
.primaryKey(): IsPrimaryKey<NotNull<this>>

// 6. $type<TType>() - Custom type override
.$type<TType>(): $Type<this, TType>

// 7. unique() - Unique constraint
.unique(name?: string): this

// 8. references() - Foreign key (PostgreSQL/MySQL)
.references(ref: () => Column, actions?: { onUpdate, onDelete }): this
```

**Example with chain:**

```typescript
const userId = integer('user_id')
  .primaryKey()
  .notNull()
  .$type<UserId>() // Override TypeScript type
  .default(1); // Set default
```

---

## 4. Type System

### 4.1 MakeColumnConfig

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/column-builder.ts` (Lines 55-79)

This is the key type that transforms a column builder into a column configuration:

```typescript
export type MakeColumnConfig<
  T extends ColumnBuilderBaseConfig<ColumnDataType, string>,
  TTableName extends string,
  TData = T extends { $type: infer U } ? U : T['data'], // Use $type if present
> = {
  name: T['name'];
  tableName: TTableName;
  dataType: T['dataType'];
  columnType: T['columnType'];
  data: TData;
  driverParam: T['driverParam'];
  notNull: T extends { notNull: true } ? true : false;
  hasDefault: T extends { hasDefault: true } ? true : false;
  isPrimaryKey: T extends { isPrimaryKey: true } ? true : false;
  isAutoincrement: T extends { isAutoincrement: true } ? true : false;
  hasRuntimeDefault: T extends { hasRuntimeDefault: true } ? true : false;
  enumValues: T['enumValues'];
  baseColumn: T extends { baseBuilder: infer U extends ColumnBuilderBase }
    ? BuildColumn<TTableName, U, 'common'>
    : never;
  identity: T extends { identity: 'always' }
    ? 'always'
    : T extends { identity: 'byDefault' }
      ? 'byDefault'
      : undefined;
  generated: T extends { generated: infer G }
    ? unknown extends G
      ? undefined
      : G extends undefined
        ? undefined
        : G
    : undefined;
} & {};
```

### 4.2 BuildColumn Type

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/column-builder.ts` (Lines 319-371)

Transforms a ColumnBuilder into a Column type based on dialect:

```typescript
export type BuildColumn<
  TTableName extends string,
  TBuilder extends ColumnBuilderBase,
  TDialect extends Dialect,  // 'pg' | 'mysql' | 'sqlite' | 'singlestore' | 'common' | 'gel'
> = TDialect extends 'pg' ? PgColumn<
      MakeColumnConfig<TBuilder['_'], TTableName>,
      {},
      Simplify<Omit<TBuilder['_'], keyof MakeColumnConfig<TBuilder['_'], TTableName> | 'brand' | 'dialect'>>
    >
  : TDialect extends 'mysql' ? MySqlColumn<...>
  : TDialect extends 'sqlite' ? SQLiteColumn<...>
  // ... other dialects
  : never;
```

### 4.3 BuildColumns Type

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/column-builder.ts` (Lines 386-398)

Transforms the entire columns map:

```typescript
export type BuildColumns<
  TTableName extends string,
  TConfigMap extends Record<string, ColumnBuilderBase>,
  TDialect extends Dialect,
> = {
  [Key in keyof TConfigMap]: BuildColumn<
    TTableName,
    {
      _: Omit<TConfigMap[Key]['_'], 'name'> & {
        name: TConfigMap[Key]['_']['name'] extends ''
          ? Assume<Key, string> // Use object key if name is empty
          : TConfigMap[Key]['_']['name']; // Use configured name
      };
    },
    TDialect
  >;
} & {}; // Ensures it's a plain object type
```

### 4.4 InferSelectModel and InferInsertModel

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/table.ts` (Lines 155-206)

These are the key types for extracting TypeScript types from tables:

```typescript
// Determines if a column should be required or optional based on mode
export type InferModelFromColumns<
  TColumns extends Record<string, Column>,
  TInferMode extends 'select' | 'insert' = 'select',
  TConfig extends { dbColumnNames: boolean; override?: boolean } = {
    dbColumnNames: false;
    override: false;
  },
> = Simplify<
  TInferMode extends 'insert'
    ? // INSERT MODE
      {
        // Required columns: not null AND no default AND not generated
        [Key in keyof TColumns & string as RequiredKeyOnly<
          MapColumnName<Key, TColumns[Key], TConfig['dbColumnNames']>,
          TColumns[Key]
        >]: GetColumnData<TColumns[Key], 'query'>;
      } & {
        // Optional columns: nullable OR has default OR is generated
        [Key in keyof TColumns & string as OptionalKeyOnly<
          MapColumnName<Key, TColumns[Key], TConfig['dbColumnNames']>,
          TColumns[Key],
          TConfig['override']
        >]?: GetColumnData<TColumns[Key], 'query'> | undefined;
      }
    : // SELECT MODE - all columns are returned
      {
        [Key in keyof TColumns & string as MapColumnName<
          Key,
          TColumns[Key],
          TConfig['dbColumnNames']
        >]: GetColumnData<TColumns[Key], 'query'>;
      }
>;

// For SELECT - all columns are returned
export type InferSelectModel<
  TTable extends Table,
  TConfig extends { dbColumnNames: boolean } = { dbColumnNames: false },
> = InferModelFromColumns<TTable['_']['columns'], 'select', TConfig>;

// For INSERT - only required columns are mandatory
export type InferInsertModel<
  TTable extends Table,
  TConfig extends { dbColumnNames: boolean; override?: boolean } = {
    dbColumnNames: false;
    override: false;
  },
> = InferModelFromColumns<TTable['_']['columns'], 'insert', TConfig>;
```

### 4.5 GetColumnData

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/column.ts` (Lines 138-148)

Determines the actual data type returned for a column:

```typescript
export type GetColumnData<TColumn extends Column, TInferMode extends 'query' | 'raw' = 'query'> =
  // Raw mode - return underlying type
  TInferMode extends 'raw'
    ? TColumn['_']['data']
    : // Query mode - consider nullability
      TColumn['_']['notNull'] extends true
      ? TColumn['_']['data'] // Not null - just return data type
      : TColumn['_']['data'] | null; // Nullable - add null
```

### 4.6 RequiredKeyOnly and OptionalKeyOnly

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/operations.ts` (Lines 6-24)

Determines which columns are required vs optional for inserts:

```typescript
// Columns that MUST be provided in INSERT
export type RequiredKeyOnly<TKey extends string, T extends Column> =
  T extends AnyColumn<{ notNull: true; hasDefault: false }> ? TKey : never;

// Columns that are OPTIONAL in INSERT
export type OptionalKeyOnly<
  TKey extends string,
  T extends Column,
  OverrideT extends boolean | undefined = false,
> =
  // Skip if already required
  TKey extends RequiredKeyOnly<TKey, T>
    ? never
    : // Generated columns with always identity - only if override=true
      T extends { _: { generated: undefined } }
      ? T extends { _: { identity: undefined } }
        ? TKey // Regular nullable column - optional
        : T['_']['identity'] extends 'always'
          ? OverrideT extends true
            ? TKey
            : never // only if override=true
          : TKey // byDefault identity - optional
      : never;
```

---

## 5. IDE Autocomplete

### 5.1 JSDoc Comments

Drizzle extensively uses JSDoc comments for IDE autocomplete support:

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Examples)

````typescript
/**
 * Adds a `where` clause to the query.
 *
 * Calling this method will select only those rows that fulfill a specified condition.
 *
 * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
 *
 * @param where the `where` clause.
 *
 * @example
 * You can use conditional operators and `sql function` to filter the rows to be selected.
 *
 * ```ts
 * // Select all cars with green color
 * await db.select().from(cars).where(eq(cars.color, 'green'));
 * // or
 * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
 * ```
 */
where(
  where: ((aliases: this['_']['selection']) => SQL | undefined) | SQL | undefined,
): PgSelectWithout<this, TDynamic, 'where'>
````

### 5.2 Type Branded Properties

The `brand` property in type configs helps TypeScript differentiate between similar types:

```typescript
// In column-builder.ts
export type ColumnBuilderTypeConfig<...> = Simplify<
  & {
    brand: 'ColumnBuilder';  // Brand identifier
    name: T['name'];
    dataType: T['dataType'];
    // ...
  }
  & TTypeConfig
>;

// In column.ts
export type ColumnTypeConfig<T extends ColumnBaseConfig, TTypeConfig extends object> = T & {
  brand: 'Column';  // Different brand for Column
  tableName: T['tableName'];
  // ...
} & TTypeConfig;
```

### 5.3 Typed Selection Proxy

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/selection-proxy.ts`

Drizzle uses a Proxy-based selection system that provides autocomplete for column references:

```typescript
// When you write: db.select({ userId: users.id }).from(users)
// The proxy provides autocomplete for:
// - users.id
// - users.name
// - etc.
```

### 5.4 Function Overloads

Extensive use of function overloads for different API shapes:

```typescript
// In text() function
export function text(): PgTextBuilderInitial<'', [string, ...string[]]>;
export function text<U extends string, T extends Readonly<[U, ...U[]]>>(
  config?: PgTextConfig<T | Writable<T>>,
): PgTextBuilderInitial<'', Writable<T>>;
export function text<TName extends string, U extends string, T extends Readonly<[U, ...U[]]>>(
  name: TName,
  config?: PgTextConfig<T | Writable<T>>,
): PgTextBuilderInitial<TName, Writable<T>>;
```

---

## 6. Query Building

### 6.1 Select Query Types

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/query-builders/select.types.ts` (Lines 1-175)

The select system uses a sophisticated type system to track:

- Selection fields
- Nullability based on joins
- Select mode ('partial', 'single', 'multiple')

```typescript
export type SelectMode = 'partial' | 'single' | 'multiple';

// Result type computation
export type SelectResult<
  TResult,
  TSelectMode extends SelectMode,
  TNullabilityMap extends Record<string, JoinNullability>,
> = TSelectMode extends 'partial'
  ? SelectPartialResult<TResult, TNullabilityMap>
  : TSelectMode extends 'single'
    ? SelectResultFields<TResult>
    : ApplyNotNullMapToJoins<SelectResultFields<TResult>, TNullabilityMap>;

// Nullability application based on join types
export type ApplyNullability<
  T,
  TNullability extends JoinNullability,
> = TNullability extends 'nullable' ? T | null : TNullability extends 'null' ? null : T;

// Join nullability tracking
export type JoinNullability = 'nullable' | 'not-null';
```

### 6.2 PgSelectBase

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 1028-1125)

```typescript
export interface PgSelectBase<
  TTableName extends string | undefined,
  TSelection extends ColumnsSelection,
  TSelectMode extends SelectMode,
  TNullabilityMap extends Record<string, JoinNullability> = ...,
  TDynamic extends boolean = false,
  TExcludedMethods extends string = never,
  TResult extends any[] = SelectResult<TSelection, TSelectMode, TNullabilityMap>[],
  TSelectedFields extends ColumnsSelection = BuildSubquerySelection<TSelection, TNullabilityMap>,
> extends PgSelectQueryBuilderBase<...>, QueryPromise<TResult>, SQLWrapper {}
```

### 6.3 Insert Query Types

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 42-49)

```typescript
// Insert value type derived from table's InferInsertModel
export type PgInsertValue<
  TTable extends PgTable<TableConfig>,
  OverrideT extends boolean = false,
> = {
  [Key in keyof InferInsertModel<TTable, { dbColumnNames: false; override: OverrideT }>]:
    | InferInsertModel<TTable, { dbColumnNames: false; override: OverrideT }>[Key]
    | SQL
    | Placeholder;
} & {};
```

### 6.4 Update Query Types

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/update.ts` (Lines 63-71)

```typescript
// Update set source type
export type PgUpdateSetSource<TTable extends PgTable> = {
  [Key in keyof TTable['$inferInsert']]?:
    | GetColumnData<TTable['_']['columns'][Key]> // Column data type
    | SQL
    | PgColumn
    | undefined; // Optional - partial updates
} & {};
```

---

## 7. Relations

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/relations.ts` (Lines 1-725)

### 7.1 Relation Classes

```typescript
export class One<
  TTableName extends string = string,
  TIsNullable extends boolean = boolean,
> extends Relation<TTableName> {
  // One-to-one or one-to-many relationship
}

export class Many<TTableName extends string> extends Relation<TTableName> {
  // Many-to-one relationship
}
```

### 7.2 Relation Definition

```typescript
// Define relations for a table
export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  // ...
});

export const posts = pgTable('posts', {
  id: integer('id').primaryKey(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id),
  // ...
});

// Define relations
export const usersRelations = relations(users, ({ one, many }) => ({
  posts: many(posts, {
    // One user has many posts
    relationName: 'author',
    fields: [users.id],
    references: [posts.authorId],
  }),
}));
```

### 7.3 Relational Schema Config

```typescript
export interface TableRelationalConfig {
  tsName: string; // TypeScript property name
  dbName: string; // Database table name
  columns: Record<string, Column>;
  relations: Record<string, Relation>;
  primaryKey: AnyColumn[];
  schema?: string;
}

export type TablesRelationalConfig = Record<string, TableRelationalConfig>;
```

---

## 8. Database Adapter Differences

### 8.1 PostgreSQL

**Key Features:**

- Row-Level Security (RLS)
- Generated columns with `generatedAlwaysAsIdentity()`
- Array columns via `.array()` method
- PostgreSQL-specific types: uuid, inet, cidr, jsonb, etc.
- Policies for RLS

**Files:**

- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/table.ts`
- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/columns/common.ts`

### 8.2 MySQL

**Key Features:**

- Auto-increment via `.autoincrement()` method
- Generated columns (virtual/stored)
- MySQL-specific types: year, datetime, set, enum, etc.

**Files:**

- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/mysql-core/table.ts`
- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/mysql-core/columns/common.ts`

### 8.3 SQLite

**Key Features:**

- Simpler type system (TEXT, INTEGER, REAL, BLOB)
- Integer primary keys are auto-incrementing
- No foreign key actions by default

**Files:**

- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sqlite-core/table.ts`
- `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sqlite-core/columns/common.ts`

---

## 9. Type Flow Diagrams

### 9.1 Table Definition Type Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TABLE DEFINITION FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

pgTable('users', { columns })
         │
         ▼
┌────────────────────────────────────┐
│ PgTableFn interface overloads       │
│ (function signature definitions)    │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ pgTableWithSchema() function        │
│ (runtime implementation)            │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ 1. Create PgTable instance          │
│ 2. Process columns (parsedColumns)  │
│ 3. Build each column via .build()   │
│ 4. Return PgTableWithColumns<T>     │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ PgTableWithColumns<T> =            │
│   & PgTable<T>                      │
│   & { [K in columns]: Column }     │
│   & { enableRLS: () => ... }        │
└────────────────────────────────────┘

Column Building Flow:

integer() / text() / varchar() / etc.
         │
         ▼
┌────────────────────────────────────┐
│ ColumnBuilderInitial type           │
│ (not yet configured)                │
└────────────────────────────────────┘
         │
         ▼
.notNull() / .default() / .primaryKey() / .$type<T>()
         │
         ▼
┌────────────────────────────────────┐
│ ColumnBuilder with _ type modifier   │
│ - NotNull<T>                        │
│ - HasDefault<T>                     │
│ - IsPrimaryKey<T>                   │
│ - $Type<T, U>                       │
└────────────────────────────────────┘
         │
         ▼
.build(table)
         │
         ▼
┌────────────────────────────────────┐
│ MakeColumnConfig<T, TableName>      │
│ (transforms builder config to       │
│  column config)                     │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Column<T> (final column type)       │
└────────────────────────────────────┘
```

### 9.2 Type Inference Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TYPE INFERENCE FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  age: integer('age'),  // nullable, no default
})

         │
         ▼
┌────────────────────────────────────┐
│ users.$inferSelect                 │
│ = InferSelectModel<typeof users>   │
│ = {                                │
│   id: number,      // notNull=true │
│   name: string,    // notNull=true │
│   email: string,    // notNull=true │
│   age: number | null  // nullable   │
│ }                                  │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ users.$inferInsert                 │
│ = InferInsertModel<typeof users>   │
│ = {                                │
│   // Required (notNull + no default)│
│   id: number,      // PK has ident. │
│   name: string,    // notNull       │
│   email: string,   // notNull       │
│   // Optional                          │
│   age?: number | null  // nullable   │
│ }                                  │
└────────────────────────────────────┘
```

### 9.3 Select Query Type Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SELECT QUERY TYPE FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

db.select().from(users)
         │
         ▼
┌────────────────────────────────────┐
│ PgSelectBuilder.from(table)        │
│ Returns: PgSelectBase<...>         │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Type inference from table config:   │
│ TTableName = 'users'               │
│ TSelection = users['_']['columns'] │
│ TSelectMode = 'single'             │
│ TNullabilityMap = { users: 'not-null' }
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Result type:                       │
│ SelectResult<                       │
│   TSelection,                      │
│   TSelectMode,                     │
│   TNullabilityMap                  │
│ >[]                                │
│ = users.$inferSelect[]             │
└────────────────────────────────────┘

With LEFT JOIN:

db.select().from(users).leftJoin(posts, eq(users.id, posts.userId))
         │
         ▼
┌────────────────────────────────────┐
│ AppendToNullabilityMap<            │
│   { users: 'not-null' },          │
│   'posts',                         │
│   'left'                           │
│ >                                  │
│ = { users: 'not-null', posts: 'nullable' }
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Result type:                       │
│ {                                  │
│   users: { id, name, ... },       │
│   posts: { id, title, ... } | null │ // Nullable due to LEFT JOIN
│ }                                  │
└────────────────────────────────────┘
```

---

## 10. Gotchas and Edge Cases

### 10.1 Empty Column Names

When using column helpers without a name, the object key becomes the column name:

```typescript
// CORRECT: Name from object key
const id = integer(); // If used as: { id: integer() }, name = 'id'

// INCORRECT: Relying on initial name
const id = integer(); // Initially name = ''
```

### 10.2 Generated Columns and Identity

```typescript
// PostgreSQL: generatedAlwaysAsIdentity vs generatedByDefaultAsIdentity
integer('id').generatedAlwaysAsIdentity();
//   - Always generates a value, cannot be overridden
integer('id').generatedByDefaultAsIdentity();
//   - Uses default if not provided, can be overridden in INSERT
```

### 10.3 Nullable Primary Keys

```typescript
// Primary key automatically becomes notNull
integer('id').primaryKey();
// Equivalent to:
integer('id').primaryKey().notNull();

// But you can still make it nullable in the data model
// (though this is usually a bad idea)
```

### 10.4 Update Set Partial Updates

```typescript
// All columns are optional in UPDATE
.update(posts).set({ title: 'New Title' })
// Even if name is notNull, it's optional in UPDATE

// To make a column required in UPDATE:
export type PgUpdateSetSource<TTable extends PgTable> = {
  [Key in keyof TTable['$inferInsert']]?: ...
  // Note the ? - all are optional!
}
```

### 10.5 Type Branded Columns

```typescript
// Using $type to create branded types
const userId = integer('user_id').$type<UserId>();

// userId is still typed as integer, but TypeScript
// will treat UserId as a distinct type
const id: UserId = userId.default(1); // Works!
```

### 10.6 Subquery and Empty Selection

```typescript
// Error: Cannot select from subquery without returning clause
db.select().from(
  db.insert(posts).values({ title: 'Test' }),
  // Missing .returning()
);
```

### 10.7 Join Nullability

```typescript
// LEFT JOIN makes the joined table nullable
const result = await db.select().from(users).leftJoin(posts, eq(users.id, posts.userId));
// result.posts is: Posts | null

// INNER JOIN makes columns not-null
const result2 = await db.select().from(users).innerJoin(posts, eq(users.id, posts.userId));
// result.posts is: Posts (not null)
```

### 10.8 Enum Columns

```typescript
// Define enum with text/varchar
const statusEnum = ['active', 'inactive', 'pending'] as const;

const users = pgTable('users', {
  status: text('status', {
    enum: statusEnum,
  }).notNull(),
});

// InferSelectModel will have: status: 'active' | 'inactive' | 'pending'
```

### 10.9 Array Columns (PostgreSQL)

```typescript
const tags = pgTable('posts', {
  tags: text('tags').array().notNull(),
});

// Type: string[]
```

### 10.10 Custom Type Override

```typescript
// Override the data type while keeping SQL behavior
const jsonColumn = text('data').$type<MyAppData>();
// jsonColumn._.data is MyAppData
// jsonColumn.getSQLType() is 'text'
```

---

## Important File Reference

| File                                                | Purpose                                           |
| --------------------------------------------------- | ------------------------------------------------- |
| `/drizzle-orm/src/table.ts`                         | Base Table class and InferModel types             |
| `/drizzle-orm/src/column-builder.ts`                | ColumnBuilder base, MakeColumnConfig, BuildColumn |
| `/drizzle-orm/src/column.ts`                        | Column base class, GetColumnData                  |
| `/drizzle-orm/src/entity.ts`                        | entityKind pattern, is() function                 |
| `/drizzle-orm/src/operations.ts`                    | RequiredKeyOnly, OptionalKeyOnly                  |
| `/drizzle-orm/src/pg-core/table.ts`                 | pgTable implementation                            |
| `/drizzle-orm/src/pg-core/columns/common.ts`        | PgColumnBuilder, PgColumn base                    |
| `/drizzle-orm/src/pg-core/columns/text.ts`          | Text column implementation                        |
| `/drizzle-orm/src/pg-core/columns/integer.ts`       | Integer column implementation                     |
| `/drizzle-orm/src/pg-core/query-builders/select.ts` | Select query builder                              |
| `/drizzle-orm/src/query-builders/select.types.ts`   | Select type utilities                             |
| `/drizzle-orm/src/relations.ts`                     | Relations definition system                       |
| `/drizzle-orm/src/utils.ts`                         | Utility types (Simplify, Equal, etc.)             |

---

## Conclusion

Drizzle ORM's type system is built on several key patterns:

1. **Builder Pattern**: Column types use a fluent builder API that modifies type-level metadata through type modifiers (NotNull, HasDefault, etc.)

2. **Config Transformation**: The `MakeColumnConfig` type transforms builder configs into column configs, extracting type information at compile time.

3. **Dialect Abstraction**: Database-specific types (PgColumn, MySqlColumn, SQLiteColumn) all extend a common base, allowing a unified API with dialect-specific implementations.

4. **Runtime + Compile-time**: The `entityKind` pattern allows runtime type checking while the TypeScript types provide compile-time safety.

5. **Type Inference**: Types like `InferSelectModel` and `InferInsertModel` automatically derive TypeScript types from table definitions.

Understanding these patterns will help you extend Drizzle or debug type-related issues.

---

# APPENDIX: CRUD Operations, Query Methods, and IDE Autocomplete Deep Dive

This appendix provides a comprehensive, developer-focused explanation of how Drizzle ORM's CRUD operations work internally, with a specific focus on how VSCode/IDE autocomplete is enabled through TypeScript patterns.

---

## Table of Contents (Appendix)

1. [The Proxy System: Foundation of Autocomplete](#1-the-proxy-system-foundation-of-autocomplete)
2. [SELECT Query System](#2-select-query-system)
3. [INSERT Operations](#3-insert-operations)
4. [UPDATE Operations](#4-update-operations)
5. [DELETE Operations](#5-delete-operations)
6. [Query Building Chain and Type Safety](#6-query-building-chain-and-type-safety)
7. [Condition/Operator System](#7-conditionoperator-system)
8. [Join Operations](#8-join-operations)
9. [Subqueries and CTEs](#9-subqueries-and-ctes)
10. [Aggregation and Grouping](#10-aggregation-and-grouping)
11. [Utility Methods](#11-utility-methods)
12. [Transaction Support](#12-transaction-support)
13. [Raw SQL Integration with Template Tags](#13-raw-sql-integration-with-template-tags)
14. [Type Flow Summary](#14-type-flow-summary)

---

## 1. The Proxy System: Foundation of Autocomplete

### 1.1 Why Proxies?

Drizzle's autocomplete is primarily powered by **JavaScript Proxy objects**. Proxies allow Drizzle to intercept property access on table objects and provide intelligent suggestions based on the table's column definitions.

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/alias.ts` (Lines 1-75)

The key insight is that when you write `users.id`, you're not just accessing a property - you're accessing a **proxy handler** that:

1. Returns the column with metadata about its table
2. Enables TypeScript to infer the column type
3. Allows the column to be used in SQL expressions

### 1.2 TableAliasProxyHandler

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/alias.ts` (Lines 24-75)

```typescript
export class TableAliasProxyHandler<T extends Table | View> implements ProxyHandler<T> {
  static readonly [entityKind]: string = 'TableAliasProxyHandler';

  constructor(
    private alias: string,
    private replaceOriginalName: boolean,
  ) {}

  get(target: T, prop: string | symbol): any {
    // When accessing Table.Symbol.IsAlias - return true for aliased tables
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }

    // When accessing Table.Symbol.Name - return the alias
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }

    // When accessing Table.Symbol.Columns - return proxied columns
    if (prop === Table.Symbol.Columns) {
      const columns = (target as Table)[Table.Symbol.Columns];
      const proxiedColumns: { [key: string]: any } = {};

      Object.keys(columns).map((key) => {
        // Each column gets wrapped with ColumnAliasProxyHandler
        proxiedColumns[key] = new Proxy(
          columns[key]!,
          new ColumnAliasProxyHandler(new Proxy(target, this)),
        );
      });

      return proxiedColumns;
    }

    // For column access, wrap the column
    const value = target[prop as keyof typeof target];
    if (is(value, Column)) {
      return new Proxy(value as AnyColumn, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }

    return value;
  }
}
```

### 1.3 ColumnAliasProxyHandler

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/alias.ts` (Lines 10-22)

```typescript
export class ColumnAliasProxyHandler<TColumn extends Column> implements ProxyHandler<TColumn> {
  static readonly [entityKind]: string = 'ColumnAliasProxyHandler';

  constructor(private table: Table | View) {}

  get(columnObj: TColumn, prop: string | symbol): any {
    // When accessing .table property - return the proxied table
    if (prop === 'table') {
      return this.table;
    }

    return columnObj[prop as keyof TColumn];
  }
}
```

### 1.4 How Proxy Enables Autocomplete

When you write this code:

```typescript
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

// This creates a proxy around the table
const result = await db.select({ userId: users.id, userName: users.name }).from(users);
```

The proxy chain works like this:

```
users (Proxy with TableAliasProxyHandler)
  └── users.id (accessing 'id' property)
      └── Returns: Proxy with ColumnAliasProxyHandler
          └── get('table') returns the proxied users table
```

**Why this enables autocomplete:**

1. **Type Inference**: When TypeScript sees `users.`, it looks at the table type definition which includes all column types
2. **Runtime Column Access**: The proxy intercepts `users.id` and returns the actual Column object
3. **Table Reference Preservation**: The column's `.table` property points back to the proxied table
4. **SQL Expression Building**: The column can be used in `sql\`${users.id}\`` expressions

### 1.5 SelectionProxyHandler

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/selection-proxy.ts` (Lines 1-121)

This is used for providing autocomplete inside `.where()`, `.orderBy()`, and similar callback functions:

```typescript
export class SelectionProxyHandler<T extends Subquery | Record<string, unknown> | View>
  implements ProxyHandler<Subquery | Record<string, unknown> | View>
{
  static readonly [entityKind]: string = 'SelectionProxyHandler';

  private config: {
    alias?: string;
    sqlAliasedBehavior: 'sql' | 'alias';
    sqlBehavior: 'sql' | 'error';
    replaceOriginalName?: boolean;
  };

  constructor(config: SelectionProxyHandler<T>['config']) {
    this.config = { ...config };
  }

  get(subquery: T, prop: string | symbol): any {
    // Extract columns from the selection
    const columns = is(subquery, Subquery)
      ? subquery._.selectedFields
      : is(subquery, View)
      ? subquery[ViewBaseConfig].selectedFields
      : subquery;

    const value: unknown = columns[prop as keyof typeof columns];

    // Handle aliased SQL expressions
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === 'sql' && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }

    // Handle columns - apply table alias if needed
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(value.table, new TableAliasProxyHandler(this.config.alias, ...))
          ),
        );
      }
      return value;
    }

    // Recursively handle nested selections
    if (typeof value === 'object' && value !== null) {
      return new Proxy(value, new SelectionProxyHandler(this.config));
    }

    return value;
  }
}
```

**Usage in where clause:**

```typescript
// The proxy allows this autocomplete:
// .where() receives a function with typed 'aliases' parameter
await db
  .select()
  .from(users)
  .where((aliases) => eq(aliases.id, 1));
//        ^ autocomplete shows: { id, name, email, ... }
```

---

## 2. SELECT Query System

### 2.1 How `db.select()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 435-443)

The `select()` method creates a `PgSelectBuilder` with optional fields:

```typescript
// db.ts - select() method signature
select(): PgSelectBuilder<undefined>;  // No fields specified - select all
select<TSelection extends SelectedFields>(fields: TSelection): PgSelectBuilder<TSelection>;
select<TSelection extends SelectedFields>(fields?: TSelection): PgSelectBuilder<TSelection | undefined> {
  return new PgSelectBuilder({
    fields: fields ?? undefined,  // Pass fields to builder
    session: this.session,
    dialect: this.dialect,
  });
}
```

### 2.2 How `from()` Works and Provides Table Autocomplete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 109-150)

```typescript
from<TFrom extends PgTable | Subquery | PgViewBase | SQL>(
  source: TableLikeHasEmptySelection<TFrom> extends true
    ? DrizzleTypeError<"Cannot reference a data-modifying statement subquery...">
    : TFrom,
): CreatePgSelectFromBuilderMode<
  TBuilderMode,
  GetSelectTableName<TFrom>,        // Extract table name for type
  TSelection extends undefined ? GetSelectTableSelection<TFrom> : TSelection,
  TSelection extends undefined ? 'single' : 'partial'  // Select mode
> {
  const isPartialSelect = !!this.fields;
  const src = source as TFrom;

  let fields: SelectedFields;

  if (this.fields) {
    // User specified fields - use those
    fields = this.fields;
  } else if (is(src, Subquery)) {
    // Subquery - extract fields from subquery
    fields = Object.fromEntries(
      Object.keys(src._.selectedFields).map((key) => [key, src[key] as SelectedFields[string]])
    );
  } else if (is(src, PgViewBase)) {
    // View - use view's selected fields
    fields = src[ViewBaseConfig].selectedFields as SelectedFields;
  } else if (is(src, SQL)) {
    // Raw SQL - no fields
    fields = {};
  } else {
    // Regular table - use table columns
    fields = getTableColumns<PgTable>(src);
  }

  return (new PgSelectBase({
    table: src,
    fields,
    isPartialSelect,
    session: this.session,
    dialect: this.dialect,
    withList: this.withList,
    distinct: this.distinct,
  }).setToken(this.authToken)) as any;
}
```

**Key Type Helpers:**

```typescript
// GetSelectTableName - extracts the table name as a string literal type
export type GetSelectTableName<TTable extends TableLike> = TTable extends Table
  ? TTable['_']['name'] // 'users'
  : TTable extends Subquery
    ? TTable['_']['alias'] // 'userStats'
    : TTable extends View
      ? TTable['_']['name'] // 'activeUsers'
      : TTable extends SQL
        ? undefined
        : never;

// GetSelectTableSelection - extracts the column definitions
export type GetSelectTableSelection<TTable extends TableLike> = TTable extends Table
  ? TTable['_']['columns'] // { id: PgInteger, name: PgText, ... }
  : TTable extends Subquery | View
    ? TTable['_']['selectedFields']
    : TTable extends SQL
      ? {}
      : never;
```

### 2.3 How Column Selection Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 436-437)

When you write:

```typescript
const result = await db
  .select({
    userId: users.id,
    userName: users.name,
  })
  .from(users);
```

The selection object `{ userId: users.id, userName: users.name }` is typed as:

```typescript
type TSelection = {
  userId: PgInteger<MakeColumnConfig<...>>;  // The column type
  userName: PgText<MakeColumnConfig<...>>;   // The column type
};
```

### 2.4 How Selection Proxy Provides Autocomplete

When you access table properties in the selection object, the proxy system enables autocomplete:

```typescript
// TypeScript sees this:
{ userId: users.id, ... }
//   ^ When you type 'users.', VSCode shows all columns

// This works because:
// 1. 'users' has type PgTableWithColumns<T>
// 2. PgTableWithColumns includes all columns as direct properties
// 3. Accessing users.id returns the column type
// 4. The column can be used as a selection field
```

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/table.ts` (Lines 121-129)

```typescript
export type PgTableWithColumns<T extends TableConfig> = PgTable<T> & {
  // Columns become direct properties on the table
  [Key in keyof T['columns']]: T['columns'][Key];
} & {
  enableRLS: () => Omit<PgTableWithColumns<T>, 'enableRLS'>;
};
```

### 2.5 Result Type Computation

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/query-builders/select.types.ts` (Lines 39-45)

```typescript
export type SelectResult<
  TResult,
  TSelectMode extends SelectMode,
  TNullabilityMap extends Record<string, JoinNullability>,
> =
  // 'partial' mode - for partial selections
  TSelectMode extends 'partial'
    ? SelectPartialResult<TResult, TNullabilityMap>
    : // 'single' mode - when selecting all columns
      TSelectMode extends 'single'
      ? SelectResultFields<TResult>
      : // 'multiple' mode - after joins
        ApplyNotNullMapToJoins<SelectResultFields<TResult>, TNullabilityMap>;
```

**SelectResultFields** transforms column types to data types:

```typescript
// File: /drizzle-orm/src/query-builders/select.types.ts (Lines 162-167)
export type SelectResultField<T, TDeep extends boolean = true> = T extends Table
  ? SelectResultField<T['_']['columns'], false>
  : T extends Column<any>
    ? GetColumnData<T> // Column -> data type
    : T extends SQL | SQL.Aliased
      ? T['_']['type'] // SQL expr -> declared type
      : T extends Record<string, any>
        ? SelectResultFields<T, true>
        : never;
```

---

## 3. INSERT Operations

### 3.1 How `db.insert(table)` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 577-579)

```typescript
insert<TTable extends PgTable>(table: TTable): PgInsertBuilder<TTable, TQueryResult> {
  return new PgInsertBuilder(table, this.session, this.dialect);
}
```

### 3.2 How `.values()` Provides Autocomplete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 42-49)

```typescript
// The type that enables autocomplete for .values()
export type PgInsertValue<
  TTable extends PgTable<TableConfig>,
  OverrideT extends boolean = false,
> = {
  [Key in keyof InferInsertModel<TTable, { dbColumnNames: false; override: OverrideT }>]:
    | InferInsertModel<TTable, { dbColumnNames: false; override: OverrideT }>[Key]
    | SQL
    | Placeholder;
} & {};
```

**How this works:**

```typescript
// Example: users table with { id, name, email }
// - id: integer (has identity, so optional)
// - name: text notNull (required)
// - email: text notNull (required)

type InsertType = PgInsertValue<typeof users>;
// = {
//     name: string | SQL | Placeholder;   // Required
//     email: string | SQL | Placeholder;  // Required
//     id?: number | SQL | Placeholder | undefined;  // Optional (has default)
//   }

// Usage with autocomplete:
await db.insert(users).values({
  name: 'John', // autocomplete shows: name, email, id
  email: 'john@example.com',
});
```

### 3.3 How `.values()` Validates Column Names and Types

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 82-110)

```typescript
values(value: PgInsertValue<TTable, OverrideT>): PgInsertBase<TTable, TQueryResult>;
values(values: PgInsertValue<TTable, OverrideT>[]): PgInsertBase<TTable, TQueryResult>;
values(values: ...): PgInsertBase<TTable, TQueryResult> {
  values = Array.isArray(values) ? values : [values];
  if (values.length === 0) {
    throw new Error('values() must be called with at least one value');
  }

  // Map values to columns with proper types
  const mappedValues = values.map((entry) => {
    const result: Record<string, Param | SQL> = {};
    const cols = this.table[Table.Symbol.Columns];

    for (const colKey of Object.keys(entry)) {
      const colValue = entry[colKey as keyof typeof entry];
      // Wrap non-SQL values in Param with column encoder
      result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
    }
    return result;
  });

  return new PgInsertBase(this.table, mappedValues, ...);
}
```

### 3.4 How `.returning()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 289-299)

```typescript
returning(): PgInsertWithout<PgInsertReturningAll<this, TDynamic>, TDynamic, 'returning'>;
returning<TSelectedFields extends SelectedFieldsFlat>(
  fields: TSelectedFields,
): PgInsertWithout<PgInsertReturning<this, TDynamic, TSelectedFields>, TDynamic, 'returning'>;
returning(
  fields: SelectedFieldsFlat = this.config.table[Table.Symbol.Columns],
): PgInsertWithout<AnyPgInsert, TDynamic, 'returning'> {
  this.config.returningFields = fields;
  this.config.returning = orderSelectedFields<PgColumn>(fields);
  return this as any;
}
```

**Returning types:**

```typescript
// Returning all columns
export type PgInsertReturningAll<T extends AnyPgInsert, TDynamic extends boolean> = PgInsertBase<
  T['_']['table'],
  T['_']['queryResult'],
  T['_']['table']['_']['columns'], // All columns
  T['_']['table']['$inferSelect'], // Full select type
  TDynamic,
  T['_']['excludedMethods']
>;

// Returning specific columns
export type PgInsertReturning<
  T extends AnyPgInsert,
  TDynamic extends boolean,
  TSelectedFields extends SelectedFieldsFlat,
> = PgInsertBase<
  T['_']['table'],
  T['_']['queryResult'],
  TSelectedFields,
  SelectResultFields<TSelectedFields>, // Transformed result type
  TDynamic,
  T['_']['excludedMethods']
>;
```

### 3.5 How `.onConflictDoNothing()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 323-338)

```typescript
onConflictDoNothing(
  config: { target?: IndexColumn | IndexColumn[]; where?: SQL } = {},
): PgInsertWithout<this, TDynamic, 'onConflictDoNothing' | 'onConflictDoUpdate'> {
  if (config.target === undefined) {
    this.config.onConflict = sql`do nothing`;
  } else {
    let targetColumn = '';
    targetColumn = Array.isArray(config.target)
      ? config.target.map((it) => this.dialect.escapeName(...)).join(',')
      : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));

    const whereSql = config.where ? sql` where ${config.where}` : undefined;
    this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
  }
  return this as any;
}
```

### 3.6 How `.onConflictDoUpdate()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/insert.ts` (Lines 369-389)

```typescript
onConflictDoUpdate(
  config: PgInsertOnConflictDoUpdateConfig<this>,
): PgInsertWithout<this, TDynamic, 'onConflictDoNothing' | 'onConflictDoUpdate'> {
  // Validate that user doesn't mix deprecated and new options
  if (config.where && (config.targetWhere || config.setWhere)) {
    throw new Error(
      'You cannot use both "where" and "targetWhere"/"setWhere"...'
    );
  }

  const setSql = this.dialect.buildUpdateSet(
    this.config.table,
    mapUpdateSet(this.config.table, config.set)  // Uses same type system as UPDATE
  );

  // Build: ON CONFLICT (col) WHERE targetWhere DO UPDATE SET ... SETWHERE
  this.config.onConflict = sql`...`;
  return this as any;
}
```

---

## 4. UPDATE Operations

### 4.1 How `db.update(table)` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 549-551)

```typescript
update<TTable extends PgTable>(table: TTable): PgUpdateBuilder<TTable, TQueryResult> {
  return new PgUpdateBuilder(table, this.session, this.dialect);
}
```

### 4.2 How `.set()` Provides Autocomplete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/update.ts` (Lines 63-71)

```typescript
// Type that enables autocomplete for .set()
export type PgUpdateSetSource<TTable extends PgTable> = {
  [Key in keyof TTable['$inferInsert']]?:
    | GetColumnData<TTable['_']['columns'][Key]> // Column data type
    | SQL // SQL expression
    | PgColumn // Another column
    | undefined; // Optional - all keys optional!
} & {};
```

**Key insight: All columns are optional in UPDATE!**

```typescript
// Example: users table
// UPDATE users SET name = 'new name'
// Note: NOT all columns required - each is optional with '?'

type UpdateSet = PgUpdateSetSource<typeof users>;
// = {
//     id?: number | SQL | PgColumn | undefined;
//     name?: string | SQL | PgColumn | undefined;
//     email?: string | SQL | PgColumn | undefined;
//   }
```

### 4.3 How Set Types Are Derived from Table Definitions

The `PgUpdateSetSource` type uses `TTable['$inferInsert']` which is derived from `InferInsertModel`:

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/table.ts` (Lines 598-601)

```typescript
export type InferInsertModel<
  TTable extends Table,
  TConfig extends { dbColumnNames: boolean; override?: boolean } = {
    dbColumnNames: false;
    override: false;
  },
> = InferModelFromColumns<TTable['_']['columns'], 'insert', TConfig>;
```

### 4.4 How `.where()` Works with Update Queries

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/update.ts` (Lines 508-511)

```typescript
where(where: SQL | undefined): PgUpdateWithout<this, TDynamic, 'where'> {
  this.config.where = where;
  return this as any;
}
```

The update query uses the same selection proxy system as SELECT for the WHERE clause:

```typescript
await db.update(users).set({ name: 'New Name' }).where(eq(users.id, 1));
//              ^ Still gets autocomplete for users.id
```

---

## 5. DELETE Operations

### 5.1 How `db.delete(table)` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 605-607)

```typescript
delete<TTable extends PgTable>(table: TTable): PgDeleteBase<TTable, TQueryResult> {
  return new PgDeleteBase(table, this.session, this.dialect);
}
```

### 5.2 How `.where()` Works with Delete Queries

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/delete.ts` (Lines 196-199)

```typescript
where(where: SQL | undefined): PgDeleteWithout<this, TDynamic, 'where'> {
  this.config.where = where;
  return this as any;
}
```

### 5.3 How `.returning()` Works with Delete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/delete.ts` (Lines 221-231)

```typescript
returning(): PgDeleteReturningAll<this, TDynamic>;
returning<TSelectedFields extends SelectedFieldsFlat>(
  fields: TSelectedFields,
): PgDeleteReturning<this, TDynamic, TSelectedFields>;
returning(
  fields: SelectedFieldsFlat = this.config.table[Table.Symbol.Columns],
): PgDeleteReturning<this, TDynamic, any> {
  this.config.returningFields = fields;
  this.config.returning = orderSelectedFields<PgColumn>(fields);
  return this as any;
}
```

---

## 6. Query Building Chain and Type Safety

### 6.1 How Methods Are Chained

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 765-778)

Each method returns `this as any` but with a different type signature. The key pattern is `PgSelectWithout`:

```typescript
// File: /drizzle-orm/src/pg-core/query-builders/select.types.ts (Lines 246-264)
export type PgSelectWithout<
  T extends AnyPgSelectQueryBuilder,
  TDynamic extends boolean,
  K extends keyof T & string,  // The method being called
  TResetExcluded extends boolean = false,
> =
  // If dynamic mode, return same type
  TDynamic extends true ? T

  // Otherwise, omit the called method from the type
  : Omit<
    PgSelectKind<...>,  // Reconstruct the query type
    TResetExcluded extends true
      ? K                           // Omit just K
      : T['_']['excludedMethods'] | K  // Omit K and previously excluded methods
  >;
```

### 6.2 How Each Method Modifies the Type

**Type transformation through chain:**

```typescript
// Start: PgSelectBase (all methods available)
db.select()
  .from(users)
  // After .from(): Returns PgSelectWithFrom
  // Only 'where' excluded method reset, others still available
  .where(eq(users.id, 1))
  // After .where(): Returns PgSelectWithout<'where'>
  // 'orderBy' still available
  .orderBy(users.name)
  // After .orderBy(): Returns PgSelectWithout<'orderBy'>
  // 'limit' still available
  .limit(10)
  // After .limit(): Returns PgSelectWithout<'limit'>
  // 'offset' still available
  .offset(5);
```

### 6.3 What Prevents Invalid Method Calls

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.types.ts` (Lines 236-244)

```typescript
// Methods excluded after set operators (union, intersect, etc.)
export type PgSetOperatorExcludedMethods =
  | 'leftJoin' // Can't join after union
  | 'rightJoin'
  | 'innerJoin'
  | 'fullJoin'
  | 'where' // Can't have where after union
  | 'having'
  | 'groupBy'
  | 'for';
```

**Type safety example:**

```typescript
// This would be a compile error:
db.select().from(users).union(db.select().from(posts)).where(eq(users.id, 1));
//                                              ^^^^^ Error! 'where' is excluded after union
```

---

## 7. Condition/Operator System

### 7.1 How Operators Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/expressions/conditions.ts` (Lines 32-42)

```typescript
// The BinaryOperator interface defines overloads for different column types
export interface BinaryOperator {
  // Column-based comparison
  <TColumn extends Column>(left: TColumn, right: GetColumnData<TColumn, 'raw'> | SQLWrapper): SQL;

  // Aliased SQL expression
  <T>(left: SQL.Aliased<T>, right: T | SQLWrapper): SQL;

  // Generic SQL wrapper
  <T extends SQLWrapper>(left: Exclude<T, SQL.Aliased | Column>, right: unknown): SQL;
}
```

### 7.2 How `eq()` Provides Column Autocomplete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/expressions/conditions.ts` (Lines 62-64)

```typescript
export const eq: BinaryOperator = (left: SQLWrapper, right: unknown): SQL => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
```

**Autocomplete works because:**

```typescript
// In .where() callback, aliases has selection proxy type:
// type Aliases = TSelection  // e.g., { id: PgInteger, name: PgText, ... }

.where((aliases) => eq(aliases.id, 1))
//          ^^^^^^^ Autocomplete shows: id, name, email, ...

// When you type eq(aliases., TypeScript:
// 1. Sees aliases is a proxy
// 2. Accessing aliases.id returns PgInteger column
// 3. eq() accepts Column as first argument
// 4. Right side is typed based on column's data type
```

### 7.3 How Operators Validate Column/Table Relationships

The type system ensures type safety through generics:

```typescript
// eq() first parameter accepts Column (or SQL wrapper)
// The column type determines what the second parameter can be

eq(users.id, 'string'); // Error! users.id is integer
eq(users.name, 123); // Error! users.name is text
eq(users.name, 'John'); // OK! types match
```

### 7.4 bindIfParam: Ensuring Correct Parameter Types

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/expressions/conditions.ts` (Lines 17-30)

```typescript
export function bindIfParam(value: unknown, column: SQLWrapper): SQLChunk {
  // If value is not already a SQL wrapper, wrap it as a Param
  // with the column's encoder for proper type conversion
  if (
    isDriverValueEncoder(column) &&
    !isSQLWrapper(value) &&
    !is(value, Param) &&
    !is(value, Placeholder) &&
    !is(value, Column) &&
    !is(value, Table) &&
    !is(value, View)
  ) {
    return new Param(value, column); // Use column's encoder
  }
  return value as SQLChunk;
}
```

---

## 8. Join Operations

### 8.1 How Join Methods Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 229-314)

```typescript
private createJoin<
  TJoinType extends JoinType,
  TIsLateral extends (TJoinType extends 'full' | 'right' ? false : boolean),
>(
  joinType: TJoinType,
  lateral: TIsLateral,
): 'cross' extends TJoinType ? PgSelectCrossJoinFn<...> : PgSelectJoinFn<...> {
  return ((table, on) => {
    // Add to used tables
    for (const item of extractUsedTable(table)) this.usedTables.add(item);

    // Nest fields for first table if not partial select
    if (!this.isPartialSelect) {
      if (Object.keys(this.joinsNotNullableMap).length === 1) {
        this.config.fields = {
          [baseTableName]: this.config.fields,  // Nest as object
        };
      }
      // Add joined table fields
      if (typeof tableName === 'string' && !is(table, SQL)) {
        this.config.fields[tableName] = selection;
      }
    }

    // Apply selection proxy to on clause
    if (typeof on === 'function') {
      on = on(new Proxy(
        this.config.fields,
        new SelectionProxyHandler({ sqlAliasedBehavior: 'sql', sqlBehavior: 'sql' }),
      ) as TSelection);
    }

    // Update nullability map based on join type
    switch (joinType) {
      case 'left': this.joinsNotNullableMap[tableName] = false; break;
      case 'inner': this.joinsNotNullableMap[tableName] = true; break;
      // ...
    }

    return this as any;
  }) as any;
}
```

### 8.2 How Autocomplete Works with Joined Tables

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/query-builders/select.types.ts` (Lines 104-114)

```typescript
export type AppendToResult<
  TTableName extends string | undefined,
  TResult,
  TJoinedName extends string | undefined,
  TSelectedFields extends SelectedFields<Column, Table>,
  TOldSelectMode extends SelectMode,
> = TOldSelectMode extends 'partial'
  ? TResult // Keep as-is for partial select
  : TOldSelectMode extends 'single'
    ? (TTableName extends string ? Record<TTableName, TResult> : TResult) &
        (TJoinedName extends string ? Record<TJoinedName, TSelectedFields> : TSelectedFields)
    : TResult &
        (TJoinedName extends string ? Record<TJoinedName, TSelectedFields> : TSelectedFields);
```

**Result after join:**

```typescript
const result = await db.select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId));

// Type of result:
type Result = {
  users: { id: number; name: string; email: string; };
  posts: { id: number; title: string; authorId: number; } | null;  // Nullable due to LEFT JOIN
}[];

// Autocomplete when selecting:
db.select({
  userName: users.name,       // Works - users available
  postTitle: posts.title,     // Works - posts available
  // posts might be null, so TypeScript knows
}).from(users).leftJoin(...)
```

### 8.3 How Nullability Is Tracked

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/query-builders/select.types.ts` (Lines 137-147)

```typescript
export type AppendToNullabilityMap<
  TJoinsNotNull extends Record<string, JoinNullability>,
  TJoinedName extends string | undefined,
  TJoinType extends JoinType,
> = TJoinedName extends string
  ? 'left' extends TJoinType
    ? TJoinsNotNull & { [name in TJoinedName]: 'nullable' } // LEFT JOIN
    : 'right' extends TJoinType
      ? SetJoinsNullability<TJoinsNotNull, 'nullable'> & { [name in TJoinedName]: 'not-null' } // RIGHT JOIN
      : 'inner' extends TJoinType
        ? TJoinsNotNull & { [name in TJoinedName]: 'not-null' } // INNER JOIN
        : 'cross' extends TJoinType
          ? TJoinsNotNull & { [name in TJoinedName]: 'not-null' } // CROSS JOIN
          : 'full' extends TJoinType
            ? SetJoinsNullability<TJoinsNotNull, 'nullable'> & { [name in TJoinedName]: 'nullable' } // FULL JOIN
            : never
  : TJoinsNotNull;
```

### 8.4 How `.using()` Would Work (If Supported)

PostgreSQL supports `USING` clause for joins when columns have the same name. Drizzle handles this through the on clause:

```typescript
// Instead of USING:
.leftJoin(posts, eq(users.id, posts.authorId))
// You could use raw SQL if needed:
.leftJoin(posts, sql`USING (author_id)`)
```

---

## 9. Subqueries and CTEs

### 9.1 How Subquery Selection Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/subquery.ts` (Lines 1-50)

```typescript
export class Subquery<
  TAlias extends string = string,
  TSelectedFields extends Record<string, unknown> = Record<string, unknown>,
> implements SQLWrapper {
  static readonly [entityKind]: string = 'Subquery';

  declare _: {
    brand: 'Subquery';
    sql: SQL;
    selectedFields: TSelectedFields; // Type of selected fields
    alias: TAlias; // The alias for referencing
    isWith: boolean;
    usedTables?: string[];
  };

  constructor(
    sql: SQL,
    fields: TSelectedFields,
    alias: string,
    isWith = false,
    usedTables: string[] = [],
  ) {
    this._ = {
      brand: 'Subquery',
      sql,
      selectedFields: fields as TSelectedFields,
      alias: alias as TAlias,
      isWith,
      usedTables,
    };
  }
}
```

### 9.2 How `.from(subquery)` Provides Autocomplete

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 126-132)

```typescript
// In from() method:
if (is(src, Subquery)) {
  // Extract fields from subquery for selection
  fields = Object.fromEntries(
    Object.keys(src._.selectedFields).map((key) => [
      key,
      src[key as unknown as keyof typeof src] as unknown as SelectedFields[string],
    ]),
  );
}
```

**Usage example:**

```typescript
// Create a subquery
const userStats = db
  .select({
    userId: users.id,
    postCount: sql<number>`count(${posts.id})`.as('postCount'),
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .groupBy(users.id);

// Use subquery as table
const result = await db
  .select({
    userId: userStats.userId, // Autocomplete works!
    postCount: userStats.postCount, // Autocomplete works!
  })
  .from(userStats);
```

### 9.3 How Aliased Tables Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/alias.ts` (Lines 7-11)

```typescript
export function alias<TTable extends PgTable | PgViewBase, TAlias extends string>(
  table: TTable,
  alias: TAlias,
): BuildAliasTable<TTable, TAlias> {
  return new Proxy(table, new TableAliasProxyHandler(alias, false)) as any;
}
```

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.types.ts` (Lines 38-50)

```typescript
export type BuildAliasTable<TTable extends PgTable | View, TAlias extends string> =
  TTable extends Table
    ? PgTableWithColumns<
        UpdateTableConfig<TTable['_']['config'], {
          name: TAlias;
          columns: MapColumnsToTableAlias<TTable['_']['columns'], TAlias, 'pg'>;
        }>
      >
    : TTable extends View ? PgViewWithSelection<...>
    : never;
```

**Usage:**

```typescript
const u1 = alias(users, 'u1');
const u2 = alias(users, 'u2');

// Now you have two "copies" of users with different aliases
await db
  .select({
    user1Id: u1.id,
    user2Id: u2.id,
  })
  .from(u1)
  .innerJoin(u2, eq(u1.id, u2.id));
```

### 9.4 How CTEs Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 125-148)

```typescript
$with: WithBuilder = (alias: string, selection?: ColumnsSelection) => {
  const self = this;
  const as = (
    qb: TypedQueryBuilder<ColumnsSelection | undefined> | SQL | ((qb: QueryBuilder) => ...),
  ) => {
    if (typeof qb === 'function') {
      qb = qb(new QueryBuilder(self.dialect));
    }

    return new Proxy(
      new WithSubquery(
        qb.getSQL(),
        selection ?? ('getSelectedFields' in qb ? qb.getSelectedFields() ?? {} : {}) as SelectedFields,
        alias,
        true,  // isWith = true for CTE
      ),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: 'alias', sqlBehavior: 'error' }),
    );
  };
  return { as };
};
```

**Usage:**

```typescript
// Define CTE
const topUsers = db.$with('topUsers').as(
  db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .orderBy(desc(users.score))
    .limit(10),
);

// Use CTE
await db
  .with(topUsers)
  .select({
    userId: topUsers.id, // Autocomplete!
    userName: topUsers.name,
  })
  .from(topUsers);
```

---

## 10. Aggregation and Grouping

### 10.1 How `.groupBy()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 836-857)

```typescript
groupBy(
  builder: (aliases: this['_']['selection']) => ValueOrArray<PgColumn | SQL | SQL.Aliased>,
): PgSelectWithout<this, TDynamic, 'groupBy'>;
groupBy(...columns: (PgColumn | SQL | SQL.Aliased)[]): PgSelectWithout<this, TDynamic, 'groupBy'>;
groupBy(...): PgSelectWithout<this, TDynamic, 'groupBy'> {
  if (typeof columns[0] === 'function') {
    const groupBy = columns[0](
      new Proxy(
        this.config.fields,
        new SelectionProxyHandler({ sqlAliasedBehavior: 'alias', sqlBehavior: 'sql' }),
      ) as TSelection,
    );
    this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
  } else {
    this.config.groupBy = columns as (PgColumn | SQL | SQL.Aliased)[];
  }
  return this as any;
}
```

### 10.2 How `.having()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 802-815)

```typescript
having(
  having: ((aliases: this['_']['selection']) => SQL | undefined) | SQL | undefined,
): PgSelectWithout<this, TDynamic, 'having'> {
  if (typeof having === 'function') {
    having = having(
      new Proxy(
        this.config.fields,
        new SelectionProxyHandler({ sqlAliasedBehavior: 'sql', sqlBehavior: 'sql' }),
      ) as TSelection,
    );
  }
  this.config.having = having;
  return this as any;
}
```

### 10.3 How Aggregate Functions Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/functions/aggregate.ts` (Lines 1-129)

```typescript
// count - simple SQL template
export function count(expression?: SQLWrapper): SQL<number> {
  return sql`count(${expression || sql.raw('*')})`.mapWith(Number);
}

// max - infers return type from column
export function max<T extends SQLWrapper>(
  expression: T,
): SQL<(T extends AnyColumn ? T['_']['data'] : string) | null> {
  return sql`max(${expression})`.mapWith(is(expression, Column) ? expression : String) as any;
}

// avg - PostgreSQL returns numeric as string
export function avg(expression: SQLWrapper): SQL<string | null> {
  return sql`avg(${expression})`.mapWith(String);
}
```

### 10.4 Autocomplete with Aggregations

```typescript
// When you select with aggregation:
const result = await db.select({
  brand: cars.brand,
  count: sql<number>`count(*)`.as('count'),
  avgPrice: sql<string>`avg(${cars.price})`.as('avgPrice'),
})
.from(cars)
.groupBy(cars.brand);

// In having callback:
.having((row) => gt(row.count, 10))
//              ^^^^^ autocomplete: brand, count, avgPrice

// TypeScript knows:
// - row.count is number
// - gt() expects number for first parameter
```

---

## 11. Utility Methods

### 11.1 `.orderBy()`, `.limit()`, `.offset()`

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts`

All follow the same pattern as `.where()`:

```typescript
// orderBy - Lines 883-917
orderBy(
  builder: (aliases: this['_']['selection']) => ValueOrArray<PgColumn | SQL | SQL.Aliased>,
): PgSelectWithout<this, TDynamic, 'orderBy'>;
orderBy(...columns: (PgColumn | SQL | SQL.Aliased)[]): PgSelectWithout<this, TDynamic, 'orderBy'>;

// limit - Lines 935-942
limit(limit: number | Placeholder): PgSelectWithout<this, TDynamic, 'limit'>;

// offset - Lines 960-967
offset(offset: number | Placeholder): PgSelectWithout<this, TDynamic, 'offset'>;
```

### 11.2 `.distinct()`

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 469-478)

```typescript
selectDistinct(): PgSelectBuilder<undefined>;
selectDistinct<TSelection extends SelectedFields>(fields: TSelection): PgSelectBuilder<TSelection>;
selectDistinct<TSelection extends SelectedFields>(fields?: TSelection): PgSelectBuilder<...> {
  return new PgSelectBuilder({
    fields: fields ?? undefined,
    session: this.session,
    dialect: this.dialect,
    distinct: true,  // Pass distinct flag
  });
}
```

### 11.3 `.for()` (FOR UPDATE)

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 979-982)

```typescript
for(strength: LockStrength, config: LockConfig = {}): PgSelectWithout<this, TDynamic, 'for'> {
  this.config.lockingClause = { strength, config };
  return this as any;
}
```

### 11.4 `.returning()`

Already covered in INSERT/UPDATE/DELETE sections.

### 11.5 `.prepare()` and Named Statements

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/query-builders/select.ts` (Lines 1078-1098)

```typescript
_prepare(name?: string): PgSelectPrepare<this> {
  const { session, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
  if (!session) {
    throw new Error('Cannot execute on query builder. Use DB instance.');
  }

  return tracer.startActiveSpan('drizzle.prepareQuery', () => {
    const fieldsList = orderSelectedFields<PgColumn>(fields);
    const query = session.prepareQuery<PreparedQueryConfig & { execute: TResult }>(
      dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, undefined, {
        type: 'select',
        tables: [...usedTables],
      }, cacheConfig);
    query.joinsNotNullableMap = joinsNotNullableMap;
    return query.setToken(authToken);
  });
}

prepare(name: string): PgSelectPrepare<this> {
  return this._prepare(name);
}
```

### 11.6 `.all()`, `.get()`, `.run()`

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/query-promise.ts`

```typescript
// These are defined on QueryPromise and inherited by all query types
export class QueryPromise<T> {
  // Get all results
  async all(): Promise<T> {
    /* ... */
  }

  // Get first result
  async get(): Promise<T[number] | undefined> {
    /* ... */
  }

  // Run and discard results (for INSERT/UPDATE/DELETE)
  async run(): Promise<void> {
    /* ... */
  }
}
```

---

## 12. Transaction Support

### 12.1 How `db.transaction()` Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/db.ts` (Lines 636-641)

```typescript
transaction<T>(
  transaction: (tx: PgTransaction<TQueryResult, TFullSchema, TSchema>) => Promise<T>,
  config?: PgTransactionConfig,
): Promise<T> {
  return this.session.transaction(transaction, config);
}
```

### 12.2 How Transaction Callback Types Work

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/session.ts` (Lines 230-234)

```typescript
abstract transaction<T>(
  transaction: (tx: PgTransaction<TQueryResult, TFullSchema, TSchema>) => Promise<T>,
  config?: PgTransactionConfig,
): Promise<T>;
```

**The transaction callback receives the same type of DB instance:**

```typescript
// Full type of transaction parameter
type Tx = PgTransaction<
  TQueryResult, // Same as parent
  TFullSchema, // Same as parent
  TSchema // Same as parent
>;

// Which extends PgDatabase, so you get all methods:
await db.transaction(async (tx) => {
  // tx.select() - returns typed results
  // tx.insert() - works the same
  // tx.update() - works the same
  // tx.delete() - works the same

  // All with full autocomplete!
  await tx.insert(users).values({ name: 'John' });

  return tx.select().from(users).where(eq(users.name, 'John'));
});
```

### 12.3 How Rollback Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/pg-core/session.ts` (Lines 256-258)

```typescript
rollback(): never {
  throw new TransactionRollbackError();
}
```

Usage:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'John' });

  if (someCondition) {
    tx.rollback(); // Throws TransactionRollbackError
  }

  // If we get here, transaction commits
});
```

---

## 13. Raw SQL Integration with Template Tags

### 13.1 How `sql` Template Tag Works

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/sql.ts` (Lines 478-495)

```typescript
// Template tag signature
export function sql<T>(strings: TemplateStringsArray, ...params: any[]): SQL<T>;
//                   ^ TemplateStringsArray is provided by JS, not user

// Runtime implementation
export function sql(strings: TemplateStringsArray, ...params: SQLChunk[]): SQL {
  const queryChunks: SQLChunk[] = [];
  if (params.length > 0 || (strings.length > 0 && strings[0] !== '')) {
    queryChunks.push(new StringChunk(strings[0]!));
  }
  for (const [paramIndex, param] of params.entries()) {
    queryChunks.push(param, new StringChunk(strings[paramIndex + 1]!));
  }
  return new SQL(queryChunks);
}
```

### 13.2 How Autocomplete Works Inside Template Strings

**The key insight:** TypeScript's template literal types enable autocomplete when using `${}` syntax.

```typescript
// Example:
sql`SELECT * FROM ${users} WHERE ${users.id} = ${1}`;
//              ^^^^^ When you type ${, VSCode shows all columns of users

// This works because:
// 1. The `sql` function accepts SQLWrapper objects (tables, columns, etc.)
// 2. When you type ${, you're passing a value into the template
// 3. TypeScript infers the type from the column type
// 4. The sql function wraps it appropriately
```

### 13.3 How Parameters Are Typed

```typescript
// Simple typed SQL
const query = sql<{ id: number; name: string }>`
  SELECT id, name FROM ${users} WHERE ${users.id} = ${sql.param(1)}
`;

// The type parameter T in SQL<T> determines the result type
// Parameters in ${} are automatically typed

// Using with autocomplete:
const userId = 1;
sql`SELECT * FROM ${users} WHERE id = ${userId}`;
//                                 ^^^^^^^ TypeScript knows userId is number
//                                 and validates it can be a SQL parameter
```

### 13.4 Named Identifiers

**File:** `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/sql.ts` (Lines 547-553)

```typescript
export namespace sql {
  // Create a safely escaped identifier
  export function identifier(value: string): Name {
    return new Name(value);
  }
}

// Usage:
sql`SELECT * FROM ${sql.identifier('my-table')}`; // Properly quoted
```

---

## 14. Type Flow Summary

### 14.1 Complete SELECT Query Type Flow

```
User Code:
  db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, 1)).orderBy(users.name).limit(10)

Type Flow:
  1. db.select({ id: users.id, name: users.name })
     └─> Creates PgSelectBuilder<{ id: PgInteger; name: PgText }>

  2. .from(users)
     ├─> GetSelectTableName<typeof users> = 'users'
     ├─> GetSelectTableSelection<typeof users> = users['_']['columns']
     └─> Returns PgSelectBase<
           TTableName = 'users',
           TSelection = { id: PgInteger; name: PgText },
           TSelectMode = 'partial'  // Because fields were specified
         >

  3. .where(eq(users.id, 1))
     ├─> SelectionProxyHandler enables autocomplete for aliases
     ├─> eq() validates users.id type against 1
     └─> Returns PgSelectWithout<..., 'where'>

  4. .orderBy(users.name)
     └─> Returns PgSelectWithout<..., 'orderBy'>

  5. .limit(10)
     └─> Returns PgSelectWithout<..., 'limit'>

  6. .execute()
     └─> Returns Promise<{ id: number; name: string }[]>
```

### 14.2 Complete INSERT Query Type Flow

```
User Code:
  db.insert(users).values({ name: 'John', email: 'john@example.com' }).returning().get()

Type Flow:
  1. db.insert(users)
     └─> Returns PgInsertBuilder<typeof users, TQueryResult>

  2. .values({ name: 'John', email: 'john@example.com' })
     ├─> PgInsertValue<typeof users> validates keys
     ├─> Required columns must be present
     └─> Returns PgInsertBase<...>

  3. .returning()
     ├─> PgInsertReturningAll extracts all columns
     └─> Returns PgInsertBase<..., InferSelectModel<typeof users>>

  4. .get()
     └─> Returns Promise<InferSelectModel<typeof users>>
```

### 14.3 Key Type Utilities Reference

| Type Utility                | Purpose                             | Location                                          |
| --------------------------- | ----------------------------------- | ------------------------------------------------- |
| `GetColumnData<TColumn>`    | Extract column's data type          | `/drizzle-orm/src/column.ts`                      |
| `InferSelectModel<TTable>`  | Full select type from table         | `/drizzle-orm/src/table.ts`                       |
| `InferInsertModel<TTable>`  | Insert type from table              | `/drizzle-orm/src/table.ts`                       |
| `GetSelectTableName<T>`     | Extract table/subquery name         | `/drizzle-orm/src/query-builders/select.types.ts` |
| `SelectResultField<T>`      | Transform selection to result field | `/drizzle-orm/src/query-builders/select.types.ts` |
| `BuildSubquerySelection<T>` | Build selection type for subqueries | `/drizzle-orm/src/query-builders/select.types.ts` |
| `AppendToNullabilityMap`    | Track join nullability              | `/drizzle-orm/src/query-builders/select.types.ts` |

---

## 15. Complete File Reference (CRUD Operations)

| File                                                      | Purpose                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `/drizzle-orm/src/pg-core/db.ts`                          | Database class with select, insert, update, delete methods |
| `/drizzle-orm/src/pg-core/query-builders/select.ts`       | SELECT query builder implementation                        |
| `/drizzle-orm/src/pg-core/query-builders/select.types.ts` | PostgreSQL-specific select types                           |
| `/drizzle-orm/src/pg-core/query-builders/insert.ts`       | INSERT query builder implementation                        |
| `/drizzle-orm/src/pg-core/query-builders/update.ts`       | UPDATE query builder implementation                        |
| `/drizzle-orm/src/pg-core/query-builders/delete.ts`       | DELETE query builder implementation                        |
| `/drizzle-orm/src/pg-core/query-builders/count.ts`        | Count query builder                                        |
| `/drizzle-orm/src/query-builders/select.types.ts`         | Base select type utilities                                 |
| `/drizzle-orm/src/query-builders/query-builder.ts`        | TypedQueryBuilder base class                               |
| `/drizzle-orm/src/selection-proxy.ts`                     | SelectionProxyHandler for autocomplete                     |
| `/drizzle-orm/src/alias.ts`                               | TableAliasProxyHandler and ColumnAliasProxyHandler         |
| `/drizzle-orm/src/subquery.ts`                            | Subquery class                                             |
| `/drizzle-orm/src/sql/expressions/conditions.ts`          | eq, ne, gt, lt, and, or, etc.                              |
| `/drizzle-orm/src/sql/functions/aggregate.ts`             | count, sum, avg, min, max                                  |
| `/drizzle-orm/src/sql/sql.ts`                             | SQL template tag, SQL class                                |
| `/drizzle-orm/src/pg-core/session.ts`                     | Transaction and session management                         |
| `/drizzle-orm/src/pg-core/subquery.ts`                    | Subquery type helpers                                      |
| `/drizzle-orm/src/operations.ts`                          | RequiredKeyOnly, OptionalKeyOnly                           |

---

## Conclusion

Drizzle ORM achieves its excellent IDE autocomplete through several key TypeScript patterns:

1. **Proxy System**: JavaScript Proxy objects intercept property access to enable autocomplete while preserving runtime behavior.

2. **Generic Type Parameters**: Tables, columns, and queries are heavily typed with generics that carry type information through the chain.

3. **Type Inference**: TypeScript infers types from table definitions and propagates them through method chains.

4. **Template Literal Types**: The `sql` template tag leverages TypeScript's template literal types for parameter autocomplete.

5. **SelectionProxyHandler**: Provides typed aliases in callbacks for `.where()`, `.orderBy()`, etc.

6. **Brand Types**: Prevents accidental mixing of similar types while maintaining type safety.

7. **Conditional Types**: Types adapt based on the query state (joins, aggregations, etc.) to prevent invalid operations.

Understanding these patterns helps developers debug type issues and extend Drizzle when needed.
