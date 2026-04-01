# DaliORM — Main ORM Class

Type-safe SurrealDB client wrapper with schema awareness.

## Connection

```typescript
import { DaliORM } from '@woss/dali-orm';

// Remote connection (NodeDriver - WebSocket)
const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'myns',
    database: 'mydb',
    auth: { username: 'root', password: 'root' },
  },
  schema, // Optional OrmSchema
});

// Embedded connection (EmbeddedDriver - in-process SurrealKV)
const orm = await DaliORM.connect({
  embeddedDriver: {
    driver: 'embedded',
    path: '/path/to/db',
    mode: 'surrealkv',
  },
  schema,
});
```

## CRUD Operations

```typescript
// Raw CRUD (string-based table/ID)
const records = await orm.select<T>('memories'); // All records
const record = await orm.select<T>('memories:abc123'); // By ID
const created = await orm.insert<T>('users', data); // Insert (one or array)
const updated = await orm.update<T>('users:id', data); // Update by ID
const deleted = await orm.delete<T>('users:id'); // Delete by ID
```

## Query & Execute

```typescript
// Raw SQL with parameterized variables
await orm.query<T>('SELECT * FROM users WHERE age > $minAge', { minAge: 18 });

// Execute a query builder object (object with toSQL/toParams)
const [user] = await orm.execute<User>(
  select(driver, usersTable).where((w) => w.eq('id', 'user:abc')),
);
```

## Connection Management

```typescript
await orm.use('namespace', 'database'); // Switch namespace/database
orm.isConnected(); // Check connection status
orm.getDriver(); // Access underlying SurrealDriver
await orm.disconnect(); // Close connection

// Transactions
await orm.transaction(async (tx) => {
  const r1 = await tx.query('SELECT * FROM users');
  const r2 = await tx.query('SELECT * FROM posts');
  // Auto-commits on success, auto-rollbacks on error
});
```

## DaliORMTransaction

```typescript
interface DaliORMTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
}
```

## Schema Access

```typescript
// Access tables via schema on the ORM instance
orm.table('users'); // Returns TableDefinition | undefined
orm.schema?.getTables(); // All tables
```

## DaliORMConfig

```typescript
interface DaliORMConfig {
  nodeDriver?: DriverConfig; // Remote WebSocket connection
  embeddedDriver?: EmbeddedConfig; // In-process embedded SurrealDB
  config?: boolean | string | OrmConfig; // Load from config file
  codecOptions?: CodecOptions; // Value encoding/decoding
  reconnect?: boolean | ReconnectOptions; // Auto-reconnect
  schema?: OrmSchema; // Schema definitions
}
```
