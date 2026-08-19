# Drizzle ORM Query Builder - Technical Report

## Executive Summary

This report provides a comprehensive technical analysis of the Drizzle ORM query builder system. Drizzle ORM is a TypeScript-first ORM that uses a builder pattern to construct type-safe SQL queries. The system is architected around modular database dialect implementations (MySQL, PostgreSQL, SQLite, SingleStore, Gel) with shared core abstractions.

**Last Updated**: May 2026  
**Repository**: fork-drizzle-orm  
**Target Audience**: AI Agents, Contributors, Advanced Users

---

## 1. Architecture Overview

### 1.1 High-Level Design

Drizzle ORM employs a **modular dialect architecture** where each supported database has its own:

- Query builders (`SelectBuilder`, `InsertBuilder`, `UpdateBuilder`, `DeleteBase`)
- Dialect class (`MySqlDialect`, `PgDialect`, `SQLiteDialect`, etc.)
- Session implementation (handles actual database communication)
- Table and column definitions

**Core package location**: `drizzle-orm/src/`

### 1.2 Key Directory Structure

```
drizzle-orm/src/
├── mysql-core/          # MySQL implementation
│   ├── query-builders/  # Select, Insert, Update, Delete builders
│   ├── dialect.ts       # SQL generation for MySQL
│   ├── session.ts       # Database session handling
│   └── db.ts           # Database instance
├── pg-core/            # PostgreSQL implementation
├── sqlite-core/        # SQLite implementation
├── singlestore-core/   # SingleStore implementation
├── gel-core/           # Gel implementation
├── sql/                # Core SQL abstractions
│   └── sql.ts          # SQL class, sql tag, Param, Name, etc.
└── query-builders/     # Shared base classes
    └── query-builder.ts # TypedQueryBuilder base
```

---

## 2. Core Concepts

### 2.1 SQL Class and Template Tag

The `SQL` class (`drizzle-orm/src/sql/sql.ts`) is the fundamental building block for query construction.

**Location**: `/Volumes/sd/projects/forks/fork-drizzle-orm/drizzle-orm/src/sql/sql.ts`

```typescript
export class SQL<T = unknown> implements SQLWrapper {
  static readonly [entityKind]: string = 'SQL';

  declare _: {
    brand: 'SQL';
    type: T;
  };

  private shouldInlineParams = false;
  usedTables: string[] = [];

  constructor(readonly queryChunks: SQLChunk[]) {
    // Tracks which tables are used in the query
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        this.usedTables.push(chunk[Table.Symbol.Name]);
      }
    }
  }
}
```

**Key Properties**:

- `queryChunks`: Array of chunks that make up the SQL query (strings, columns, tables, params, etc.)
- `usedTables`: Tracks tables referenced in the query for caching/invalidation

### 2.2 The `sql` Tag Function

The `sql` tagged template literal is the primary way to create SQL expressions:

```typescript
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

**Usage Examples**:

```typescript
sql`SELECT * FROM users WHERE id = ${userId}`;
sql`SELECT ${users.name} FROM ${users}`;
sql.raw('SELECT 1'); // Raw SQL without processing
```

### 2.3 SQL Chunks

An `SQLChunk` can be one of:

- `StringChunk`: Raw SQL string parts
- `SQL`: Nested SQL expressions
- `Table`: Database table reference
- `Column`: Database column reference
- `View`: Database view reference
- `Subquery`: Subquery reference
- `Param`: Parameter value with optional encoder
- `Name`: Database identifier (table/column name)
- `Placeholder`: Named placeholder for prepared statements
- `undefined`: Ignored during SQL generation

### 2.4 Parameter Handling

The `Param` class wraps values with optional encoders:

```typescript
export class Param<TDataType = unknown, TDriverParamType = TDataType> implements SQLWrapper {
  constructor(
    readonly value: TDataType,
    readonly encoder: DriverValueEncoder<TDataType, TDriverParamType> = noopEncoder,
  ) {}
}
```

**Driver Value Encoders/Decoders**:

```typescript
export interface DriverValueEncoder<TData, TDriverParam> {
  mapToDriverValue(value: TData): TDriverParam | SQL;
}

export interface DriverValueDecoder<TData, TDriverParam> {
  mapFromDriverValue(value: TDriverParam): TData;
}
```

---

## 3. Query Builder Pattern

### 3.1 Builder Hierarchy

Each query type follows a two-class pattern:

```
QueryBuilder (standalone, no session)
    ↓
SelectBuilder/InsertBuilder/UpdateBuilder (configuration phase)
    ↓
SelectBase/InsertBase/UpdateBase/DeleteBase (fluent API + execution)
    ↓ extends
QueryPromise (thenable, executable)
```

### 3.2 Select Query Flow

**Step 1: Initiation**

```typescript
// From database instance
const query = db.select().from(users).where(eq(users.id, 1));

// From standalone QueryBuilder
const qb = new QueryBuilder();
const query = qb.select().from(users);
```

**Step 2: Builder Phase** (`MySqlSelectBuilder`)

Location: `drizzle-orm/src/mysql-core/query-builders/select.ts:60-152`

```typescript
export class MySqlSelectBuilder<
  TSelection extends SelectedFields | undefined,
  TPreparedQueryHKT extends PreparedQueryHKTBase,
  TBuilderMode extends 'db' | 'qb' = 'db',
> {
  static readonly [entityKind]: string = 'MySqlSelectBuilder';

  private fields: TSelection;
  private session: MySqlSession | undefined;
  private dialect: MySqlDialect;
  private withList: Subquery[] = [];
  private distinct: boolean | undefined;

  constructor(config: {
    fields: TSelection;
    session: MySqlSession | undefined;
    dialect: MySqlDialect;
    withList?: Subquery[];
    distinct?: boolean;
  }) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) this.withList = config.withList;
    this.distinct = config.distinct;
  }

  from<TFrom extends MySqlTable | Subquery | MySqlViewBase | SQL>(
    source: TFrom,
    onIndex?: ...
  ): CreateMySqlSelectFromBuilderMode<...> {
    // Creates MySqlSelectBase with config
    return new MySqlSelectBase({ table, fields, ... });
  }
}
```

**Step 3: Fluent API Phase** (`MySqlSelectBase`)

The `MySqlSelectBase` class extends `QueryPromise` and provides the chainable API:

```typescript
leftJoin = this.createJoin('left', false);
rightJoin = this.createJoin('right', false);
innerJoin = this.createJoin('inner', false);
crossJoin = this.createJoin('cross', false);

where(where: SQL | undefined): this {
  this.config.where = where;
  return this;
}

orderBy(...columns: (MySqlColumn | SQL | SQL.Aliased)[]): this {
  this.config.orderBy = columns;
  return this;
}

limit(limit: number | Placeholder): this {
  this.config.limit = limit;
  return this;
}
```

**Step 4: Execution** (via `QueryPromise.then()` or `.execute()`)

```typescript
// MySqlSelectBase.prepare() - creates prepared statement
prepare(): MySqlSelectPrepare<this> {
  if (!this.session) {
    throw new Error('Cannot execute a query on a query builder');
  }
  const fieldsList = orderSelectedFields<MySqlColumn>(this.config.fields);
  const query = this.session.prepareQuery(
    this.dialect.sqlToQuery(this.getSQL()),
    fieldsList,
    ...
  );
  return query;
}

// QueryPromise.then() triggers execution
then<TResult1 = T, TResult2 = never>(
  onFulfilled?: ...,
  onRejected?: ...,
): Promise<TResult1 | TResult2> {
  return this.execute().then(onFulfilled, onRejected);
}
```

---

## 4. SQL Generation Process

### 4.1 Config Object Accumulation

Query builders accumulate configuration in a config object:

**MySqlSelectConfig** (example):

```typescript
export interface MySqlSelectConfig {
  withList?: Subquery[];
  table: MySqlTable | Subquery | MySqlViewBase | SQL;
  fields: SelectedFields;
  distinct?: boolean;
  setOperators: { type: SetOperator; isAll: boolean; rightSelect: TypedQueryBuilder }[];
  joins?: MySqlSelectJoinConfig[];
  where?: SQL;
  having?: SQL;
  groupBy?: (MySqlColumn | SQL | SQL.Aliased)[];
  orderBy?: (MySqlColumn | SQL | SQL.Aliased)[];
  limit?: number | Placeholder;
  offset?: number | Placeholder;
  lockingClause?: { strength: LockStrength; config: LockConfig };
  useIndex?: string[];
  forceIndex?: string[];
  ignoreIndex?: string[];
}
```

### 4.2 Dialect SQL Building

Each dialect has a `buildSelectQuery()` method that converts config to SQL:

**MySqlDialect.buildSelectQuery()** (`drizzle-orm/src/mysql-core/dialect.ts:312-486`)

```typescript
buildSelectQuery({
  withList, fields, fieldsFlat, where, having,
  table, joins, orderBy, groupBy, limit, offset,
  lockingClause, distinct, setOperators,
  useIndex, forceIndex, ignoreIndex,
}: MySqlSelectConfig): SQL {

  const withSql = this.buildWithCTE(withList);
  const distinctSql = distinct ? sql` distinct` : undefined;
  const selection = this.buildSelection(fieldsList, { isSingleTable });
  const tableSql = /* handle table aliases */;
  const joinsSql = this.buildJoins(joins);
  const whereSql = where ? sql` where ${where}` : undefined;
  const havingSql = having ? sql` having ${having}` : undefined;
  const orderBySql = this.buildOrderBy(orderBy);
  const groupBySql = this.buildGroupBy(groupBy);
  const limitSql = this.buildLimit(limit);
  const offsetSql = offset ? sql` offset ${offset}` : undefined;

  return sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
}
```

### 4.3 SQL Serialization

The `SQL.toQuery()` method converts SQL chunks to final query string and parameters:

```typescript
toQuery(config: BuildQueryConfig): QueryWithTypings {
  const query = this.buildQueryFromSourceParams(this.queryChunks, config);
  return query; // { sql: string, params: unknown[] }
}

buildQueryFromSourceParams(chunks: SQLChunk[], config: BuildQueryConfig): Query {
  return mergeQueries(chunks.map((chunk): QueryWithTypings => {
    if (is(chunk, StringChunk)) {
      return { sql: chunk.value.join(''), params: [] };
    }
    if (is(chunk, Name)) {
      return { sql: escapeName(chunk.value), params: [] };
    }
    if (is(chunk, Column)) {
      return {
        sql: escapeName(chunk.tableName) + '.' + escapeName(chunk.columnName),
        params: []
      };
    }
    if (is(chunk, Param)) {
      return {
        sql: escapeParam(paramStartIndex.value++, chunk.value),
        params: [chunk.value]
      };
    }
    // ... handles Tables, Views, Subqueries, SQL, Placeholders, etc.
  }));
}
```

### 4.4 Dialect-Specific Escaping

Each dialect implements its own escaping rules:

**MySQL** (backticks):

```typescript
escapeName(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}
escapeParam(_num: number): string {
  return `?`;  // MySQL uses ? placeholders
}
```

**PostgreSQL** (double quotes):

```typescript
escapeName(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
escapeParam(num: number): string {
  return `$${num + 1}`;  // PostgreSQL uses $1, $2, etc.
}
```

**SQLite** (double quotes or backticks):

```typescript
escapeName(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
escapeParam(_num: number): string {
  return `?`;  // SQLite also uses ? placeholders
}
```

---

## 5. Insert, Update, Delete Builders

### 5.1 Insert Builder

**MySqlInsertBuilder** (`drizzle-orm/src/mysql-core/query-builders/insert.ts:49-116`)

```typescript
export class MySqlInsertBuilder<TTable extends MySqlTable> {
  private shouldIgnore = false;

  ignore(): this {
    this.shouldIgnore = true;
    return this;
  }

  values(values: MySqlInsertValue<TTable> | MySqlInsertValue<TTable>[]): MySqlInsertBase<...> {
    values = Array.isArray(values) ? values : [values];
    const mappedValues = values.map((entry) => {
      const result: Record<string, Param | SQL> = {};
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new MySqlInsertBase(table, mappedValues, this.shouldIgnore, session, dialect);
  }

  select(selectQuery: SQL | MySqlInsertSelectQueryBuilder<TTable>): MySqlInsertBase<...> {
    // INSERT INTO ... SELECT ...
  }
}
```

### 5.2 Update Builder

**MySqlUpdateBuilder** (`drizzle-orm/src/mysql-core/query-builders/update.ts:44-65`)

```typescript
export class MySqlUpdateBuilder<TTable extends MySqlTable> {
  constructor(
    private table: TTable,
    private session: MySqlSession,
    private dialect: MySqlDialect,
    private withList?: Subquery[],
  ) {}

  set(values: MySqlUpdateSetSource<TTable>): MySqlUpdateBase<...> {
    return new MySqlUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    );
  }
}
```

### 5.3 Delete Builder

**MySqlDeleteBase** (no separate builder, directly returns base)

```typescript
// Created directly from db.delete(table)
new MySqlDeleteBase(table, session, dialect, withList);

// Then chain methods:
deleteBase.where(eq(users.id, 1)).limit(1);
```

---

## 6. Session and Execution

### 6.1 Session Abstraction

Sessions handle actual database communication. Each dialect has its own session implementation.

**MySqlSession** interface (`drizzle-orm/src/mysql-core/session.ts`):

```typescript
export abstract class MySqlSession<
  TQueryResult extends MySqlQueryResultHKT,
  TPreparedQueryHKT extends PreparedQueryHKTBase,
  TPreparedQuery extends MySqlPreparedQuery<MySqlPreparedQueryConfig>,
  TTransaction extends MySqlTransaction,
> {
  abstract prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    ...
  ): TPreparedQuery;

  abstract execute(query: SQL): Promise<unknown>;

  abstract all<T = unknown>(query: SQL): Promise<T[]>;

  abstract transaction<T>(
    transaction: (tx: TTransaction) => Promise<T>,
    config?: MySqlTransactionConfig,
  ): Promise<T>;
}
```

### 6.2 Prepared Queries

Prepared queries are created by sessions and can be cached:

```typescript
export abstract class MySqlPreparedQuery<T extends MySqlPreparedQueryConfig> {
  constructor(
    private cache: Cache | undefined,
    private queryMetadata:
      { type: 'select' | 'update' | 'delete' | 'insert'; tables: string[] } | undefined,
    private cacheConfig?: WithCacheConfig,
  ) {}

  abstract execute(placeholderValues?: Record<string, unknown>): Promise<T['execute']>;

  abstract iterator(placeholderValues?: Record<string, unknown>): AsyncGenerator<T['execute'][0]>;
}
```

### 6.3 Query Execution Flow

```
User Code: await db.select().from(users).where(eq(users.id, 1))
    ↓
SelectBuilder.from() → SelectBase
    ↓
SelectBase.where() → SelectBase (returns this)
    ↓
(await triggers QueryPromise.then())
    ↓
SelectBase.execute() / prepare()
    ↓
SelectBase.getSQL() → SQL
    ↓
Dialect.sqlToQuery(sql) → { sql: string, params: unknown[] }
    ↓
Session.prepareQuery(query, fields, ...) → PreparedQuery
    ↓
PreparedQuery.execute() → Result
```

---

## 7. Caching System

### 7.1 Query Metadata

Queries track which tables they use for cache invalidation:

```typescript
// In SelectBase constructor
this.usedTables: Set<string> = new Set();

// Track tables from main table and joins
for (const item of extractUsedTable(table)) {
  this.usedTables.add(item);
}
```

### 7.2 Cache Configuration

```typescript
$withCache(config?: {
  config?: CacheConfig;
  tag?: string;
  autoInvalidate?: boolean
} | false) {
  this.cacheConfig = config === undefined
    ? { config: {}, enable: true, autoInvalidate: true }
    : config === false
    ? { enable: false }
    : { enable: true, autoInvalidate: true, ...config };
  return this;
}
```

### 7.3 Cache Usage in PreparedQuery

```typescript
protected async queryWithCache<T>(
  queryString: string,
  params: any[],
  query: () => Promise<T>,
): Promise<T> {
  // Try cache first for SELECT queries
  if (this.queryMetadata?.type === 'select') {
    const fromCache = await this.cache.get(await hashQuery(queryString, params), ...);
    if (fromCache !== undefined) return fromCache;
  }

  // Execute query
  const result = await query();

  // Store in cache for SELECT
  if (this.queryMetadata?.type === 'select') {
    await this.cache.put(await hashQuery(queryString, params), result, ...);
  }

  // Invalidate cache on mutations
  if (['insert', 'update', 'delete'].includes(this.queryMetadata?.type)) {
    await this.cache.onMutate({ tables: this.queryMetadata.tables });
  }

  return result;
}
```

---

## 8. Type System

### 8.1 Type-Safe Selection

Drizzle uses TypeScript's type system extensively for type-safe queries:

```typescript
// SelectedFields type
export type SelectedFields = Record<string, SelectedFieldsEntry>;

// When you do: db.select({ name: users.name })
// TypeScript knows the result shape: { name: string }[]
```

### 8.2 Entity Kind System

Used for runtime type checking:

```typescript
export const entityKind = Symbol('entityKind');

export function is<T extends { [entityKind]: string }>(
  value: unknown,
  constructor: T,
): value is T {
  return (value as any)?.[entityKind] === constructor[entityKind];
}

// Usage
if (is(chunk, Column)) { ... }
if (is(chunk, Table)) { ... }
```

---

## 9. Set Operations (UNION, INTERSECT, EXCEPT)

### 9.1 Set Operator Implementation

```typescript
// In SelectBase
private createSetOperator(
  type: SetOperator,
  isAll: boolean,
): (rightSelection) => this {
  return (rightSelection) => {
    const rightSelect = typeof rightSelection === 'function'
      ? rightSelection(getMySqlSetOperators())
      : rightSelection;

    // Validate same keys
    if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
      throw new Error('Set operator error: selected fields are not the same');
    }

    this.config.setOperators.push({ type, isAll, rightSelect });
    return this;
  };
}

union = this.createSetOperator('union', false);
unionAll = this.createSetOperator('union', true);
intersect = this.createSetOperator('intersect', false);
// etc.
```

### 9.2 Standalone Set Operators

```typescript
export const union = createSetOperator('union', false);

function createSetOperator(type: SetOperator, isAll: boolean) {
  return (leftSelect, rightSelect, ...restSelects) => {
    // Combine multiple selects with set operators
    return (leftSelect as AnyMySqlSelect).addSetOperators(setOperators);
  };
}
```

---

## 10. CTE Support (WITH Clauses)

### 10.1 Defining CTEs

```typescript
// Using $with
const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));

// Using in query
const result = await db.with(sq).select().from(sq);
```

### 10.2 WithSubquery

```typescript
export class WithSubquery extends Subquery {
  readonly isWith = true;
}

// In dialect
private buildWithCTE(queries: Subquery[] | undefined): SQL | undefined {
  if (!queries?.length) return undefined;

  const withSqlChunks = [sql`with `];
  for (const [i, w] of queries.entries()) {
    withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
    if (i < queries.length - 1) {
      withSqlChunks.push(sql`, `);
    }
  }
  return sql.join(withSqlChunks);
}
```

---

## 11. Key Data Structures

### 11.1 Query Config Interfaces

**MySqlSelectConfig**:

- `withList`: CTE subqueries
- `table`: Main table/view/subquery
- `fields`: Selected fields
- `distinct`: Whether to use DISTINCT
- `joins`: Array of join configurations
- `where`: WHERE clause SQL
- `having`: HAVING clause SQL
- `groupBy`: GROUP BY columns
- `orderBy`: ORDER BY columns
- `limit`, `offset`: Pagination
- `setOperators`: UNION/INTERSECT/EXCEPT
- `lockingClause`: FOR UPDATE/SHARE etc.
- `useIndex`, `forceIndex`, `ignoreIndex`: Index hints

**MySqlInsertConfig**:

- `table`: Target table
- `values`: Array of value records or SELECT query
- `ignore`: INSERT IGNORE flag
- `onConflict`: ON DUPLICATE KEY UPDATE clause
- `returning`: RETURNING clause fields

**MySqlUpdateConfig**:

- `table`: Target table
- `set`: Update values
- `where`: WHERE clause
- `orderBy`, `limit`: MySQL supports ORDER BY and LIMIT in UPDATE

**MySqlDeleteConfig**:

- `table`: Target table
- `where`: WHERE clause
- `orderBy`, `limit`: MySQL supports ORDER BY and LIMIT in DELETE

---

## 12. Extensibility

### 12.1 Adding New Dialects

To add a new database dialect:

1. Create a new directory: `drizzle-orm/src/<dialect>-core/`
2. Implement:
   - `dialect.ts`: SQL generation (`buildSelectQuery`, `buildInsertQuery`, etc.)
   - `session.ts`: Database communication
   - `query-builders/`: Query builder classes
   - `table.ts`: Table definition
   - `columns/`: Column types
3. Export from main entry point

### 12.2 Custom Column Types

```typescript
export class MyCustomColumn extends Column<...> {
  getSQLType(): string {
    return 'my_custom_type';
  }
}
```

---

## 13. Error Handling

### 13.1 Common Errors

```typescript
// Set operator field mismatch
if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
  throw new Error(
    'Set operator error (union / intersect / except): selected fields are not the same',
  );
}

// Alias conflict in joins
if (typeof tableName === 'string' && this.config.joins?.some((join) => join.alias === tableName)) {
  throw new Error(`Alias "${tableName}" is already used in this query`);
}

// Missing session for execution
if (!this.session) {
  throw new Error(
    'Cannot execute a query on a query builder. Please use a database instance instead.',
  );
}
```

### 13.2 DrizzleQueryError

```typescript
export class DrizzleQueryError extends Error {
  constructor(
    public query: string,
    public params: unknown[],
    public cause: Error,
  ) {
    super(`Drizzle Query Error: ${cause.message}`);
  }
}
```

---

## 14. Summary

The Drizzle ORM query builder system is a sophisticated, type-safe query construction framework that:

1. **Uses builder pattern**: Separate builder and executable query classes
2. **Supports multiple dialects**: MySQL, PostgreSQL, SQLite, SingleStore, Gel
3. **Type-safe**: Full TypeScript type inference for query results
4. **Flexible SQL generation**: Through the `SQL` class and dialect system
5. **Supports advanced features**: CTEs, set operations, joins, subqueries, caching
6. **Extensible**: Modular architecture allows adding new dialects and column types

**Key Files for Reference**:

- `drizzle-orm/src/sql/sql.ts` - Core SQL abstractions
- `drizzle-orm/src/mysql-core/query-builders/select.ts` - Select query implementation
- `drizzle-orm/src/mysql-core/dialect.ts` - MySQL SQL generation
- `drizzle-orm/src/query-builders/query-builder.ts` - Base query builder class
- `drizzle-orm/src/query-promise.ts` - Promise-based execution

---

## 15. Quick Reference: Method Chains

### Select

```
db.select({ fields })
  → .from(table)
  → .leftJoin/innerJoin/rightJoin/crossJoin(table, on)
  → .where(condition)
  → .groupBy(columns)
  → .having(condition)
  → .orderBy(columns)
  → .limit(n)
  → .offset(n)
  → .union/unionAll/intersect/except(otherSelect)
  → .for(strength, config)
  → await / .execute() / .prepare()
```

### Insert

```
db.insert(table)
  → .values([{...}]) or .select(query)
  → .ignore() (MySQL)
  → .onDuplicateKeyUpdate(config) (MySQL)
  → await / .execute() / .prepare()
```

### Update

```
db.update(table)
  → .set({...})
  → .where(condition)
  → .orderBy(columns)
  → .limit(n)
  → await / .execute() / .prepare()
```

### Delete

```
db.delete(table)
  → .where(condition)
  → .orderBy(columns)
  → .limit(n)
  → await / .execute() / .prepare()
```

---

**End of Report**
