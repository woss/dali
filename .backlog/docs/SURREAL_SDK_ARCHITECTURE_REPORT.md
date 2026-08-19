# SurrealDB JavaScript SDK Architecture Report

This report provides a comprehensive reference for developers wrapping new functionality around the SurrealDB JavaScript SDK. It covers class hierarchy, core methods, connection patterns, query execution, authentication, transactions, and value types.

## Table of Contents

1. [Class Hierarchy](#class-hierarchy)
2. [Core Classes](#core-classes)
3. [Connection Patterns](#connection-patterns)
4. [Query Execution](#query-execution)
5. [Authentication & Sessions](#authentication--sessions)
6. [Live Queries](#live-queries)
7. [Transactions](#transactions)
8. [Value Types](#value-types)
9. [Types](#types)
10. [Extensibility Points](#extensibility-points)
11. [Quick Reference](#quick-reference)

---

## Class Hierarchy

```
SurrealQueryable (abstract base)
    │
    ├── SurrealSession
    │       │
    │       └── Surreal (default session + connection management)
    │
    └── SurrealTransaction
```

| Class                | Extends            | Description                                         |
| -------------------- | ------------------ | --------------------------------------------------- |
| `SurrealQueryable`   | —                  | Abstract base providing all query execution methods |
| `SurrealSession`     | `SurrealQueryable` | Session-scoped context with auth and session config |
| `Surreal`            | `SurrealSession`   | Main entry point; connection + default session      |
| `SurrealTransaction` | `SurrealQueryable` | Atomic transaction scope                            |

---

## Core Classes

### `Surreal` — Main Entry Point

The primary interface for connecting to SurrealDB, managing connections, executing queries, and handling database sessions.

```ts
import { Surreal } from 'surrealdb';

const db = new Surreal(options?: DriverOptions);
```

**Properties:**

| Property      | Type                  | Description                                                       |
| ------------- | --------------------- | ----------------------------------------------------------------- |
| `status`      | `ConnectionStatus`    | `"disconnected" \| "connecting" \| "reconnecting" \| "connected"` |
| `isConnected` | `boolean`             | Whether connection is established                                 |
| `ready`       | `Promise<void>`       | Resolves when connected and ready                                 |
| `namespace`   | `string \| undefined` | Current namespace                                                 |
| `database`    | `string \| undefined` | Current database                                                  |
| `accessToken` | `string \| undefined` | Current access token                                              |
| `session`     | `Uuid \| undefined`   | Session ID (undefined for default)                                |
| `isValid`     | `boolean`             | Session validity                                                  |

**Connection Methods:**

```ts
// Connect to SurrealDB instance
db.connect(url: string | URL, opts?: ConnectOptions): Promise<true>

// Disconnect
db.close(): Promise<true>

// Health check
db.health(): Promise<void>

// Version info
db.version(): Promise<VersionInfo>

// Feature testing
db.isFeatureSupported(feature: Feature): boolean
```

**Session Management:**

```ts
// List all active sessions
db.sessions(): Promise<Uuid[]>

// Create new isolated session
db.newSession(): Promise<SurrealSession>

// Close primary session
db.closeSession(): Promise<void>
```

**Data Management:**

```ts
// Export database as SQL
db.export(options?: SqlExportOptions): Promise<string>

// Import SQL
db.import(input: string): Promise<void>
```

**Events:**

```ts
db.subscribe(
  event: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error',
  listener: (...payload) => void
): () => void
```

---

### `SurrealSession` — Session Context

Represents a scoped session with its own namespace, database, variables, and authentication state. Shares the connection with other sessions.

```ts
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('ws://localhost:8000');

const session = await db.newSession();
```

**Session Management:**

```ts
// Fork a new session from current
session.forkSession(): Promise<SurrealSession>

// Close this session
session.closeSession(): Promise<void>

// Switch namespace/database
session.use(what: NamespaceDatabase | null): Promise<NamespaceDatabase>

// Set session variable
session.set(variable: string, value: unknown): Promise<void>

// Unset session variable
session.unset(variable: string): Promise<void>

// Reset session
session.reset(): Promise<void>
```

**Authentication:**

```ts
// Sign up new record user
session.signup(auth: AccessRecordAuth): Promise<Tokens>

// Sign in with credentials
session.signin(auth: AnyAuth): Promise<Tokens>

// Authenticate with token(s)
session.authenticate(token: string | Tokens): Promise<Tokens>

// Invalidate session
session.invalidate(): Promise<void>
```

**Transaction:**

```ts
session.beginTransaction(): Promise<SurrealTransaction>
```

**Events:**

```ts
session.subscribe(
  event: 'auth' | 'using',
  listener: (...payload) => void
): () => void
```

---

### `SurrealQueryable` — Query Execution Base

Abstract base providing all database operations. Inherited by `SurrealSession` and `SurrealTransaction`.

```ts
// Access user-defined API
db.api<TPaths>(): SurrealApi<TPaths>
db.api<TPaths>(prefix: string): SurrealApi<TPaths>
```

**Query Methods:**

```ts
// Raw SurrealQL
db.query<R>(query: string | BoundQuery, bindings?: Record<string, unknown>): Query<R>
db.query<R>(boundQuery: BoundQuery): Query<R>

// Select records
db.select<T>(recordId: RecordId | RecordIdRange | Table): SelectPromise<T>

// Create record
db.create<T>(recordId: RecordId | Table): CreatePromise<T>

// Insert records
db.insert<T>(data: T | T[]): InsertPromise<T>
db.insert<T>(table: Table, data: T | T[]): InsertPromise<T>

// Update records
db.update<T>(recordId: RecordId | RecordIdRange | Table): UpdatePromise<T>

// Upsert records
db.upsert<T>(recordId: RecordId | RecordIdRange | Table): UpsertPromise<T>

// Delete records
db.delete<T>(recordId: RecordId | RecordIdRange | Table): DeletePromise<T>

// Create graph relationship
db.relate<T>(from: RecordId | RecordId[], edge: Table | RecordId, to: RecordId | RecordId[], data?: Partial<T>): RelatePromise<T>

// Live query subscription
db.live<T>(what: LiveResource): ManagedLivePromise<T>

// Subscribe to existing live query
db.liveOf(id: Uuid): UnmanagedLivePromise

// Execute function/model
db.run<T>(name: string, args?: unknown[]): RunPromise<T>
db.run<T>(name: string, version: string, args: unknown[]): RunPromise<T>

// Get authenticated user
db.auth<T>(): AuthPromise<T>
```

**Query Builder Chain Methods:**

All query methods return builder promises with chainable configuration:

```ts
// SELECT options
.select<T>(table)
  .where(condition)
  .limit(n)
  .start(n)
  .fetch(fields?)
  .groupBy(fields?)
  .orderBy(field, direction?)

// CREATE options
.create<T>(recordId)
  .content(data)
  .return(returnOption)

// UPDATE options
.update<T>(recordId)
  .content(data)
  .merge(data)
  .where(condition)
  .return(returnOption)

// INSERT options
.insert<T>(data)
  .return(returnOption)

// LIVE options
.live<T>(what)
  .diff()
  .fields(fields)
  .where(condition)
```

---

### `SurrealTransaction` — Atomic Transactions

Provides atomic transaction support. Created via `beginTransaction()`.

```ts
const txn = await session.beginTransaction();

try {
  await txn.create(recordId1).content(data1);
  await txn.create(recordId2).content(data2);
  await txn.commit();
} catch {
  await txn.cancel();
}
```

**Methods:**

```ts
// Commit all changes
txn.commit(): Promise<void>

// Discard all changes
txn.cancel(): Promise<void>
```

All `SurrealQueryable` query methods are available within transactions.

---

## Connection Patterns

### Protocols

| Protocol  | Prefix                | Use Case                                 |
| --------- | --------------------- | ---------------------------------------- |
| WebSocket | `ws://`, `wss://`     | Long-lived connections with live queries |
| HTTP      | `http://`, `https://` | Short-lived stateless requests           |
| In-memory | `mem://`              | Embedded in-memory (Node.js)             |
| IndexedDB | `indxdb://`           | Browser persistence                      |
| RocksDB   | `rocksdb://`          | File persistence (Node.js)               |

### Engine Setup

```ts
// Remote connection (WebSocket/HTTP)
import { Surreal, createRemoteEngines } from 'surrealdb';

const db = new Surreal({
  engines: createRemoteEngines(),
});

await db.connect('ws://localhost:8000');

// Embedded Node.js
import { createNodeEngines } from '@surrealdb/node';

const db = new Surreal({
  engines: {
    ...createRemoteEngines(),
    ...createNodeEngines(),
  },
});

await db.connect('mem://');

// Embedded browser (WASM)
import { createWasmEngines } from '@surrealdb/wasm';

const db = new Surreal({
  engines: {
    ...createRemoteEngines(),
    ...createWasmEngines(),
  },
});

await db.connect('mem://');
```

### Connection Options

```ts
interface ConnectOptions {
  namespace?: string;
  database?: string;
  authentication?: AuthProvider;
  versionCheck?: boolean;
  invalidateOnExpiry?: boolean;
  reconnect?: boolean | ReconnectOptions;
}

interface ReconnectOptions {
  enabled: boolean;
  attempts: number;
  retryDelay: number;
  retryDelayMax: number;
  retryDelayMultiplier: number;
  retryDelayJitter: number;
  catch?: (error: Error) => boolean;
}
```

---

## Query Execution

### Query Methods Chain

```ts
// Basic execution
const users = await db.select(new Table('users'));

// With where clause
const adults = await db.select(new Table('users')).where(gt('age', 18));

// Multiple statements
const [usersResult, postsResult] = await db
  .query<[User[], Post[]]>(
    `
  SELECT * FROM users;
  SELECT * FROM posts;
`,
  )
  .collect();

// Bound query (type-safe)
import { surql } from 'surrealdb';

const query = surql`SELECT * FROM users WHERE age > ${18}`;
const result = await db.query(query).collect();
```

### Return Options

You can specify what the query returns:

```ts
await db
  .create(new RecordId('users', 'john'))
  .content({ name: 'John' })
  .return('NONE') // Don't return
  .return('DIFF') // Return changes only
  .return('BEFORE') // Return before state
  .return('AFTER') // Return after (default)
  .return('ALL'); // Return both states
```

---

## Authentication & Sessions

### Authentication Types

```ts
// System user (root/namespace/database)
type SystemAuth = { username: string; password: string };

// Record user via access method
type AccessRecordAuth = {
  namespace: string;
  database: string;
  access: string;
  variables?: Record<string, unknown>;
};

type AnyAuth = SystemAuth | NamespaceAuth | DatabaseAuth | AccessRecordAuth;
```

### Authentication Flow

```ts
// Sign in (system user)
await db.signin({ username: 'root', password: 'root' });

// Sign in (record user)
await db.signin({
  namespace: 'my_ns',
  database: 'my_db',
  access: 'user_access',
  variables: { email: 'user@example.com', password: 'pass' },
});

// Sign up new record user
await db.signup({
  namespace: 'my_ns',
  database: 'my_db',
  access: 'user_access',
  variables: { email: 'new@example.com', password: 'pass' },
});

// Authenticate with existing token
await db.authenticate(accessToken);

// Authenticate with refresh token
const newTokens = await db.authenticate({
  access: oldAccessToken,
  refresh: refreshToken,
});

// Pass auth at connect time (auto-reconnect works)
await db.connect('ws://localhost:8000', {
  namespace: 'my_ns',
  database: 'my_db',
  authentication: {
    username: 'root',
    password: 'root',
  },
});

// Listen to auth changes
db.subscribe('auth', (tokens) => {
  if (tokens) console.log('Authenticated');
  else console.log('Signed out');
});
```

### Session Isolation

```ts
// Create isolated session
const session = await db.newSession();

// Fork existing session
const fork = await session.forkSession();

// Each has independent:
// - namespace/database
// - variables
// - authentication state

await fork.use({ namespace: 'other' });
await fork.closeSession();
```

---

## Live Queries

### Managed Live Queries

```ts
import { Table, gt } from 'surrealdb';

// Create subscription
const live = await db.live(new Table('users'));

// Configure
const live = await db.live(new Table('users')).diff().fields('name', 'email').where(gt('age', 18));

// Subscribe to updates
live.subscribe((action, result, record) => {
  switch (action) {
    case 'CREATE':
      console.log('Created:', result);
      break;
    case 'UPDATE':
      console.log('Updated:', record);
      break;
    case 'DELETE':
      console.log('Deleted:', record);
      break;
  }
});

// Or iterate
for await (const { action, value } of live) {
  console.log(`${action}:`, value);
}

// Stop live query
await live.kill();
```

### Unmanaged Live Queries

```ts
// Create via SurrealQL
const [id] = await db.query('LIVE SELECT * FROM users WHERE active = true');
const live = db.liveOf(id);

// Subscribe
live.subscribe((action, result) => {
  console.log(action, result);
});
```

### Feature Check

```ts
import { Features } from 'surrealdb';

if (db.isFeatureSupported(Features.LiveQueries)) {
  const live = await db.live(new Table('users'));
}
```

---

## Transactions

### Basic Transaction

```ts
const txn = await db.beginTransaction();

try {
  await txn.create(new RecordId('users', 'john')).content({ name: 'John' });
  await txn.create(new RecordId('posts', '1')).content({ author: 'users:john' });
  await txn.commit();
} catch (error) {
  await txn.cancel();
  throw error;
}
```

### Money Transfer

```ts
async function transfer(from: string, to: string, amount: number) {
  const txn = await db.beginTransaction();

  try {
    const fromUser = await txn.select(new RecordId('users', from));
    const toUser = await txn.select(new RecordId('users', to));

    if (fromUser.balance < amount) throw new Error('Insufficient funds');

    await txn.update(new RecordId('users', from)).merge({ balance: fromUser.balance - amount });

    await txn.update(new RecordId('users', to)).merge({ balance: toUser.balance + amount });

    await txn.commit();
    return true;
  } catch (error) {
    await txn.cancel();
    return false;
  }
}
```

---

## Value Types

### Core Classes

| Class       | SurrealQL  | Description               |
| ----------- | ---------- | ------------------------- |
| `RecordId`  | `record`   | Table + ID (`users:john`) |
| `Table`     | —          | Table reference           |
| `DateTime`  | `datetime` | Nanosecond precision time |
| `Duration`  | `duration` | Time span                 |
| `Decimal`   | `decimal`  | Arbitrary precision       |
| `Uuid`      | `uuid`     | v4 or v7 UUID             |
| `Range`     | `range`    | Bounded/unbounded range   |
| `FileRef`   | `file`     | File reference            |
| `Geometry*` | `geometry` | GeoJSON types             |

### Usage

```ts
import { RecordId, Table, DateTime, Duration, Decimal, Uuid, GeometryPoint } from 'surrealdb';

// RecordId
const id = new RecordId('users', 'john');
const parsed = RecordId.parse('users:john');

// Table
const table = new Table<User>('users');

// DateTime
const now = DateTime.now();
const parsed = DateTime.parse('2024-01-15T12:00:00.123456789Z');
const jsDate = now.toDate();

// Duration
const dur = Duration.parse('1h30m45s');
const ms = dur.toMilliseconds();

// Decimal (precision)
const price = new Decimal('19.99');
const num = price.toNumber();

// Uuid
const v4 = Uuid.v4();
const v7 = Uuid.v7();
const parsed = Uuid.parse('550e8400-e29b-41d4-a716-446655440000');

// Geometry
const point = new GeometryPoint([longitude, latitude]);
```

### Type Mapping

| SurrealQL      | JavaScript                                       |
| -------------- | ------------------------------------------------ |
| `bool`         | `boolean`                                        |
| `int`, `float` | `number`                                         |
| `string`       | `string`                                         |
| `null`         | `null`                                           |
| `none`         | `undefined`                                      |
| `array`        | `Array`                                          |
| `object`       | `Object`                                         |
| `set`          | `Set`                                            |
| `bytes`        | `Uint8Array`                                     |
| `record`       | `RecordId`                                       |
| `datetime`     | `DateTime` (or `Date` if `useNativeDates: true`) |
| `duration`     | `Duration`                                       |
| `decimal`      | `Decimal`                                        |
| `uuid`         | `Uuid`                                           |
| `geometry`     | `Geometry*`                                      |
| `range`        | `Range`                                          |

### Native Dates Option

```ts
const db = new Surreal({
  codecOptions: {
    useNativeDates: true,
  },
});
```

### String Prefixes

```ts
import { s, d, r, u } from 'surrealdb';

const str = s`hello`; // → string
const date = d`2024-01-01`; // → DateTime
const rec = r`user:1`; // → RecordId
const id = u`...`; // → Uuid
```

---

## Types

This section documents all TypeScript types and interfaces used throughout the SDK, showing how they flow through connection, authentication, session, and query operations.

### Connection Types

#### DriverOptions

Configuration passed to the `Surreal` constructor to set up the database connection.

```ts
interface DriverOptions {
  /** Custom engine implementations mapped by protocol prefix */
  engines?: Record<string, EngineFactory>;
  /** Override WebSocket implementation for non-standard environments */
  websocketImpl?: unknown;
  /** Override fetch implementation */
  fetchImpl?: Fetch;
  /** Custom encoding/decoding for values */
  codecs?: Codecs;
  /** Codec-specific configuration */
  codecOptions?: CodecOptions;
  /** Enable debug logging */
  debug?: boolean;
}
```

**Usage:**

```ts
const db = new Surreal({
  engines: {
    ...createRemoteEngines(),
    ...createNodeEngines(),
  },
  websocketImpl: globalThis.WebSocket,
  fetchImpl: fetch,
  codecOptions: {
    useNativeDates: false,
  },
});
```

#### ConnectOptions

Options passed to `db.connect()` when establishing a connection.

```ts
interface ConnectOptions {
  /** Namespace to use after connect */
  namespace?: string;
  /** Database to use after connect */
  database?: string;
  /** Authentication provider to use immediately */
  authentication?: AuthProvider;
  /** Perform version check after connect (default: true) */
  versionCheck?: boolean;
  /** Invalidate session on token expiry (default: false) */
  invalidateOnExpiry?: boolean;
  /** Reconnection behavior */
  reconnect?: boolean | ReconnectOptions;
}
```

**Usage:**

```ts
await db.connect('ws://localhost:8000', {
  namespace: 'my_ns',
  database: 'my_db',
  authentication: { username: 'root', password: 'root' },
  reconnect: {
    enabled: true,
    attempts: 5,
    retryDelay: 1000,
    retryDelayMax: 30000,
    retryDelayMultiplier: 2,
    retryDelayJitter: 100,
  },
});
```

#### ReconnectOptions

Configures automatic reconnection behavior when the connection is lost.

```ts
interface ReconnectOptions {
  /** Enable automatic reconnection */
  enabled: boolean;
  /** Maximum number of retry attempts */
  attempts: number;
  /** Initial delay between retries (ms) */
  retryDelay: number;
  /** Maximum delay between retries (ms) */
  retryDelayMax: number;
  /** Multiply delay by this factor each retry */
  retryDelayMultiplier: number;
  /** Add random jitter to delay (ms) */
  retryDelayJitter: number;
  /** Optional error handler - return true to continue retrying */
  catch?: (error: Error) => boolean;
}
```

**Usage:**

```ts
await db.connect('ws://localhost:8000', {
  reconnect: {
    enabled: true,
    attempts: 10,
    retryDelay: 500,
    retryDelayMax: 30000,
    retryDelayMultiplier: 1.5,
    retryDelayJitter: 50,
    catch: (error) => {
      console.error('Reconnect failed:', error);
      return error.code !== 'AUTH_ERROR';
    },
  },
});
```

---

### Authentication Types

#### AnyAuth

Union type representing any valid authentication credentials.

```ts
type AnyAuth = SystemAuth | NamespaceAuth | DatabaseAuth | AccessRecordAuth;

// System user (root)
type SystemAuth = {
  username: string;
  password: string;
};

// Namespace-scoped user
type NamespaceAuth = {
  namespace: string;
  username: string;
  password: string;
};

// Database-scoped user
type DatabaseAuth = {
  namespace: string;
  database: string;
  username: string;
  password: string;
};

// Record user via access method
type AccessRecordAuth = {
  namespace: string;
  database: string;
  access: string;
  variables?: Record<string, unknown>;
};
```

**Usage:**

```ts
// System auth
await db.signin({ username: 'root', password: 'root' });

// Namespace auth
await db.signin({
  namespace: 'my_ns',
  username: 'admin',
  password: 'pass',
});

// Database auth
await db.signin({
  namespace: 'my_ns',
  database: 'my_db',
  username: 'user',
  password: 'pass',
});

// Record auth
await db.signin({
  namespace: 'my_ns',
  database: 'my_db',
  access: 'user_access',
  variables: { email: 'user@example.com', password: 'pass' },
});
```

#### SystemAuth

Authentication for root/system-level users with full database access.

```ts
type SystemAuth = {
  username: string;
  password: string;
};
```

#### AccessRecordAuth

Authentication for record-based users created through an access method.

```ts
type AccessRecordAuth = {
  namespace: string;
  database: string;
  access: string;
  variables?: Record<string, unknown>;
};
```

**Usage:**

```ts
// Sign up new record user
await db.signup({
  namespace: 'my_ns',
  database: 'my_db',
  access: 'user_access',
  variables: { email: 'new@example.com', password: 'secure' },
});

// Sign in with record user
await db.signin({
  namespace: 'my_ns',
  database: 'my_db',
  access: 'user_access',
  variables: { email: 'existing@example.com', password: 'secure' },
});
```

#### Tokens

Returned after successful authentication - contains access and refresh tokens.

```ts
interface Tokens {
  /** JWT access token for API authorization */
  access: string;
  /** Refresh token for obtaining new access tokens */
  refresh: string;
}
```

**Usage:**

```ts
const tokens = await db.signin({ username: 'root', password: 'root' });
console.log('Access token:', tokens.access);
console.log('Refresh token:', tokens.refresh);

// Use access token directly
await db.authenticate(tokens.access);

// Or use both tokens for automatic refresh
await db.authenticate(tokens);
```

#### AuthProvider

Authentication that can be passed during connect for automatic reconnection.

```ts
type AuthProvider = SystemAuth | NamespaceAuth | DatabaseAuth | AccessRecordAuth | Tokens;
```

**Usage:**

```ts
// Pass authentication at connect time
await db.connect('ws://localhost:8000', {
  authentication: {
    username: 'root',
    password: 'root',
  },
});

// Or pass tokens
await db.connect('ws://localhost:8000', {
  authentication: {
    access: 'eyJ...',
    refresh: 'eyJ...',
  },
});
```

---

### Session Types

#### Session

Represents a database session with its own context.

```ts
interface Session {
  /** Unique session identifier */
  id: Uuid;
  /** Current namespace */
  namespace: string | undefined;
  /** Current database */
  database: string | undefined;
  /** Session-specific variables */
  variables: Record<string, unknown>;
  /** Authentication tokens */
  tokens: Tokens | undefined;
  /** Whether session is valid */
  isValid: boolean;
  /** Session creation timestamp */
  createdAt: DateTime;
}
```

#### NamespaceDatabase

Target namespace and database for session operations.

```ts
type NamespaceDatabase = {
  namespace?: string;
  database?: string;
};
```

**Usage:**

```ts
// Switch namespace/database
await db.use({ namespace: 'my_ns', database: 'my_db' });

// Switch only namespace
await db.use({ namespace: 'my_ns' });

// Switch only database
await db.use({ database: 'my_db' });
```

#### SessionEvents

Events emitted by session objects.

```ts
type SessionEvents = {
  /** Authentication state changed */
  auth: Tokens | undefined;
  /** Namespace/database changed */
  using: NamespaceDatabase;
};
```

#### SurrealEvents

Events emitted by the main `Surreal` instance.

```ts
type SurrealEvents = {
  /** Connection process started */
  connecting: void;
  /** Successfully connected */
  connected: void;
  /** Reconnection in progress */
  reconnecting: void;
  /** Disconnected */
  disconnected: void;
  /** Connection error occurred */
  error: Error;
};
```

**Usage:**

```ts
const unsubscribe = db.subscribe('connected', () => {
  console.log('Connected to database!');
});

// Remove listener
unsubscribe();

// Multiple event types
db.subscribe('connecting', () => console.log('Connecting...'));
db.subscribe('connected', () => console.log('Connected'));
db.subscribe('reconnecting', () => console.log('Reconnecting...'));
db.subscribe('disconnected', () => console.log('Disconnected'));
db.subscribe('error', (err) => console.error('Error:', err));
```

---

### Query Types

#### RecordResult

Generic type for database query results.

```ts
type RecordResult<T> = T extends ? T : never;
```

The SDK uses conditional types to ensure type safety. Results are strictly typed based on the query.

#### QueryResponse

Response from a raw query execution.

```ts
interface QueryResponse<T> {
  /** Query results */
  result: T[];
  /** Query execution statistics */
  stats?: QueryStats;
}
```

**Usage:**

```ts
const response = await db.query<User[]>('SELECT * FROM users WHERE age > $age', {
  age: 18,
});

console.log(response.result); // User[]
console.log(response.stats); // QueryStats | undefined
```

#### QueryStats

Execution statistics returned with query responses.

```ts
interface QueryStats {
  /** Time taken to execute (nanoseconds) */
  execution_time: string;
  /** Time taken to process (nanoseconds) */
  process_time: string;
  /** Number of records returned */
  result_count: number;
}
```

#### LiveResource

Target for a live query subscription.

```ts
type LiveResource = Table | RecordId | RecordIdRange;
```

**Usage:**

```ts
// Live query on entire table
await db.live(new Table("users"));

// Live query on specific record
await db.live(new RecordId("users", "john"));

// Live query on record range
await db.live(new RecordIdRange("users").range([undefined, "m"));
```

#### LiveMessage

Message received through a live query subscription.

```ts
interface LiveMessage<T> {
  /** Live query action */
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE';
  /** Updated record data */
  data: T;
  /** Unique message ID */
  id: Uuid;
  /** Original state (for UPDATE) */
  original: T | undefined;
}
```

**Usage:**

```ts
const live = await db.live(new Table('users'));

live.subscribe((message) => {
  switch (message.action) {
    case 'CREATE':
      console.log('Created:', message.data);
      break;
    case 'UPDATE':
      console.log('Updated from:', message.original);
      console.log('Updated to:', message.data);
      break;
    case 'DELETE':
      console.log('Deleted:', message.data);
      break;
    case 'CLOSE':
      console.log('Live query closed');
      break;
  }
});

// Async iteration
for await (const message of live) {
  console.log(message.action, message.data);
}
```

---

### Value Types

#### RecordIdValue

A record identifier value for queries.

```ts
type RecordIdValue = string | RecordId;
```

#### Values

Union of all SurrealDB value types.

```ts
type Values =
  | boolean
  | number
  | string
  | null
  | undefined
  | Date
  | Array<Values>
  | Record<string, Values>
  | Set<Values>
  | Uint8Array
  | RecordId
  | DateTime
  | Duration
  | Decimal
  | Uuid
  | Geometry;
```

#### Nullable

Type representing nullable values.

```ts
type Nullable<T> = T | null;
```

**Generic Constraint:**

```ts
// In query results
async function getUser(id: string): Promise<Nullable<User>> {
  const result = await db.select(new RecordId('users', id));
  if (!result) return null;
  return result;
}

const user = await getUser('john');
if (user === null) {
  console.log('User not found');
}
```

---

### Codec Types

#### CodecOptions

Configuration options for value encoding/decoding.

```ts
interface CodecOptions {
  /** Use native JavaScript Date instead of DateTime */
  useNativeDates?: boolean;
  /** Custom visitor for encoding values */
  valueEncodeVisitor?: (value: unknown) => unknown;
  /** Custom visitor for decoding values */
  valueDecodeVisitor?: (value: unknown) => unknown;
}
```

**Usage:**

```ts
// Use native JavaScript Date
const db = new Surreal({
  codecOptions: {
    useNativeDates: true,
  },
});

// Custom encoding
const db = new Surreal({
  codecOptions: {
    valueEncodeVisitor: (value) => {
      if (value instanceof CustomClass) {
        return value.toJSON();
      }
      return value;
    },
  },
});

// Custom decoding
const db = new Surreal({
  codecOptions: {
    valueDecodeVisitor: (value) => {
      if (value?.type === 'CustomType') {
        return CustomClass.fromJSON(value);
      }
      return value;
    },
  },
});
```

#### Prettify

Utility type that flattens nested intersection types for better readability.

```ts
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
```

The SDK uses this internally for complex type inference.

---

### Export/Import Types

#### SqlExportOptions

Options for database export.

```ts
interface SqlExportOptions {
  /** Include namespace in output (default: true) */
  namespace?: boolean;
  /** Include database in output (default: true) */
  database?: boolean;
  /** Include user definitions in output (default: true) */
  users?: boolean;
  /** Include schema in output (default: true) */
  schema?: boolean;
  /** Include data in output (default: true) */
  data?: boolean;
}
```

**Usage:**

```ts
// Full export
const sql = await db.export();

// Export without data
const schema = await db.export({ data: false });

// Export only users and data
const usersAndData = await db.export({
  namespace: false,
  database: false,
  schema: false,
});
```

---

### Utility Types

#### EventPublisher

Generic event publisher type for Observable pattern implementation.

```ts
interface EventPublisher<T extends Record<string, unknown[]>> {
  /** Subscribe to an event */
  subscribe<K extends keyof T>(event: K, listener: (...args: T[K]) => void): () => void;
  /** Publish an event */
  publish<K extends keyof T>(event: K, ...args: T[K]): void;
}
```

#### ApiRequest

Type for user-defined API request parameters.

```ts
type ApiRequest<TPaths, TPath extends keyof TPaths> = TPaths[TPath] extends [
  infer TParams,
  infer TResponse,
]
  ? { params?: TParams; response?: TResponse }
  : never;
```

---

### Generic Type Parameters

The SDK heavily uses generic type parameters to maintain type safety throughout the API. This section provides comprehensive documentation on how TypeScript generics work in the query methods.

#### Overview

Generic type parameters flow through the SDK in this pattern:

1. **Input**: You provide a type parameter T representing your data
2. **Process**: The SDK wraps/transforms your type based on the operation
3. **Output**: Returns `RecordResult<T>` or `T` depending on the method

---

#### RecordResult<T>

The `RecordResult<T>` type is a wrapper that adds the `id: RecordId` property to your data type. Every record stored in SurrealDB has a unique record ID, and this type ensures that ID is always available in query results.

**Type Definition:**

```ts
type RecordResult<T> = T & {
  id: RecordId;
};
```

**How It Transforms Your Interface:**

```ts
interface User {
  name: string;
  email: string;
  age: number;
}

// RecordResult<User> becomes:
interface RecordResult_User {
  name: string;
  email: string;
  age: number;
  id: RecordId; // Added by RecordResult wrapper
}
```

**Input vs Output Types:**

| Step   | Type                 | Description                     |
| ------ | -------------------- | ------------------------------- |
| Input  | `User`               | Your plain interface without ID |
| Output | `RecordResult<User>` | Your interface + `id: RecordId` |

---

#### Per-Method Generic Breakdown

##### select<T>

The `select<T>` method retrieves a single record by its RecordId.

**Method Signature:**

```ts
select<T>(thing: RecordId): Promise<RecordResult<T> | null>
```

**Generic Parameter:**

| Parameter | Description                                   |
| --------- | --------------------------------------------- |
| `T`       | The type of the record you expect to retrieve |

**Return Type:**

- Returns `RecordResult<T>` if the record exists
- Returns `null` if the record doesn't exist

**Example:**

```ts
interface User {
  name: string;
  email: string;
  age: number;
}

// Select returns RecordResult<User> with the id field included
const user = await db.select<User>(new RecordId('users', 'john'));

if (user) {
  // user is typed as RecordResult<User>
  console.log(user.id); // RecordId: "users:john"
  console.log(user.name); // string
  console.log(user.email); // string
}
```

---

##### create<T>

The `create<T>` method inserts a new record into the specified table.

**Method Signature:**

```ts
create<T>(table: Table): Creator<T>

// Where Creator<T> has:
content(data: T): Promise<RecordResult<T>>
```

**Generic Parameter:**

| Parameter | Description                  |
| --------- | ---------------------------- |
| `T`       | The type of record to create |

**Return Type:**

Returns `RecordResult<T>` - the newly created record with its assigned ID.

**Example:**

```ts
interface User {
  name: string;
  email: string;
  age: number;
}

// Create returns the inserted record including its id
const created = await db.create<User>(new Table('users')).content({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});

// created is RecordResult<User>
console.log(created.id); // RecordId: "users:..."
console.log(created.name); // "John"
```

---

##### insert<T>

The `insert<T>` method handles both single and bulk record insertion.

**Method Signatures:**

```ts
// Single record
insert<T>(table: Table): InserterSingle<T>
insert(data: T): Promise<RecordResult<T>>

// Multiple records (when single: false is passed)
insert<T>(table: Table): InserterBulk<T>
insert(data: T[]): Promise<RecordResult<T>[]>
```

**Return Types:**

| Scenario         | Return Type         |
| ---------------- | ------------------- |
| Single record    | `RecordResult<T>`   |
| Multiple records | `RecordResult<T>[]` |

**Example:**

```ts
// Single insert - returns single record
const single = await db.insert<User>(new Table('users')).one({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});
// single: RecordResult<User>

// Bulk insert - returns array
const bulk = await db.insert<User>(new Table('users')).bulk([
  {
    name: 'John',
    email: 'john@example.com',
    age: 30,
  },
  {
    name: 'Jane',
    email: 'jane@example.com',
    age: 25,
  },
]);
// bulk: RecordResult<User>[]
```

---

##### update<T>

The `update<T>` method modifies existing records using either full replacement or merging.

**Method Signature:**

```ts
update<T>(thing: RecordId): Updater<T>

// Full replacement - content()
content(data: T): Promise<RecordResult<T>>

// Partial update - merge()
merge(data: Partial<T>): Promise<RecordResult<T>>
```

**Two Update Patterns:**

| Method       | Behavior                | Use Case            |
| ------------ | ----------------------- | ------------------- |
| `.content()` | Replaces entire record  | Full record updates |
| `.merge()`   | Deep merges into record | Partial updates     |

**Example:**

```ts
interface User {
  name: string;
  email: string;
  age: number;
}

// Full replacement - content() replaces the entire record
const replaced = await db.update<User>(new RecordId('users', 'john')).content({
  name: 'John Updated',
  email: 'newemail@example.com',
  age: 31,
});
// replaced: RecordResult<User>

// Partial update - merge() only updates specified fields
const merged = await db.update<User>(new RecordId('users', 'john')).merge({
  name: 'John Merged',
});
// merged: RecordResult<User>
```

---

##### upsert<T>

The `upsert<T>` method creates a record if it doesn't exist, or replaces it if it does.

**Method Signature:**

```ts
upsert<T>(thing: RecordId): Upsertor<T>

// content() creates or replaces
content(data: T): Promise<RecordResult<T>>
```

**Behavior:**

Combines create and update: inserts a new record when the ID doesn't exist, or replaces the existing record when it does.

**Example:**

```ts
// If "john" doesn't exist, creates them
// If "john" exists, replaces them
const result = await db.upsert<User>(new RecordId('users', 'john')).content({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});
// result: RecordResult<User>
```

---

##### delete<T>

The `delete<T>` method removes a record and returns the deleted data.

**Method Signature:**

```ts
delete<T>(thing: RecordId): Promise<RecordResult<T> | null>
```

**Return Type:**

- Returns `RecordResult<T>` (the deleted record) if deletion succeeded
- Returns `null` if the record didn't exist

**Example:**

```ts
// Delete returns the deleted record
const deleted = await db.delete<User>(new RecordId('users', 'john'));

if (deleted) {
  // deleted: RecordResult<User> - the data that was removed
  console.log(deleted.id);
  console.log(deleted.name);
}
```

---

##### relate<T>

The `relate<T>` method creates an edge relationship between two records.

**Method Signature:**

```ts
relate<T>(thing: RecordId): Relater<T>

// content() creates the edge
content(data: T): Promise<RecordResult<T>>
```

**Edge Record Type:**

Relationship records include the `id`, `in`, and `out` fields:

```ts
interface Edge<T> {
  id: RecordId;
  in: RecordId; // Source record
  out: RecordId; // Target record
  // ... T fields
}
```

**Example:**

```ts
interface Follow {
  since: Date;
}

// Create edge: user "john" follows user "jane"
const edge = await db.relate<Follow>(new RecordId('follows', 'follow')).content({
  in: new RecordId('users', 'john'),
  out: new RecordId('users', 'jane'),
  since: new Date(),
});

// edge: RecordResult<Follow> with in, out, and id fields
console.log(edge.id); // RecordId: "follows:follow"
console.log(edge.in); // RecordId: "users:john"
console.log(edge.out); // RecordId: "users:jane"
```

---

##### live<T>

The `live<T>` method sets up a live query that streams real-time updates.

**Method Signature:**

```ts
live<T>(table: Table): LiveSelect<T>

// subscribe() receives typed messages
subscribe(callback: (message: LiveMessage<T>) => void): () => void
```

**Message Type:**

```ts
interface LiveMessage<T> {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: RecordResult<T>; // The current record state
  id: string; // Unique message ID
}
```

**Example:**

```ts
// Set up live query on users table
const unsubscribe = await db.live<User>(new Table('users')).subscribe((message) => {
  // message.data is typed as RecordResult<User>

  switch (message.action) {
    case 'CREATE':
      console.log('Created:', message.data.name);
      break;
    case 'UPDATE':
      console.log('Updated:', message.data.name);
      break;
    case 'DELETE':
      console.log('Deleted:', message.data.name);
      break;
  }
});

// Later, stop receiving updates
unsubscribe();
```

---

##### run<T>

The `run<T>` method executes a defined function with the given parameters.

**Method Signature:**

```ts
run<T>(name: string, ...args: unknown[]): Promise<T>
```

**Generic Parameter:**

| Parameter | Description                                    |
| --------- | ---------------------------------------------- |
| `T`       | The return type of the function being executed |

**Example:**

```ts
// Define a function
await db.query(`
  DEFINE FUNCTION fn::get_user($id) {
    RETURN (SELECT * FROM users WHERE id = $id)[0]
  }
`);

// Run returns the function's return type
const user = await db.run<User>('fn::get_user', 'john');
// user: User (raw return, not wrapped in RecordResult)
```

---

#### Query Type Parameter

```ts
// Type-safe result with custom SurrealQL
const users = await db.query<User[]>('SELECT * FROM users');
```

The type parameter flows through:

1. Input: Query string + bindings
2. Process: Result row mapping
3. Output: `QueryResponse<T>`

---

#### Values<T> Type

The `Values<T>` utility type extracts the record data without the `id` property, useful for creating and updating records.

**Type Definition:**

```ts
type Values<T> = Omit<T, 'id'>;
```

**Practical Use:**

When you need to extract just the data fields (excluding the ID) for operations:

```ts
interface User {
  id: RecordId;
  name: string;
  email: string;
  age: number;
}

// Values<User> removes the id field
type UserValues = Values<User>;
// Equivalent to:
type UserValues = {
  name: string;
  email: string;
  age: number;
};

// Perfect for create/update payloads:
const userData: Values<User> = {
  name: 'John',
  email: 'john@example.com',
  age: 30,
};
// No id field - let SurrealDB generate it

await db.create<User>(new Table('users')).content(userData);
```

---

#### Generic Constraints

Type parameters must extend certain types in specific contexts:

##### Where T Must Extend `Values`

Methods that accept data input require T to extend `Values`:

```ts
// create, insert, update, upsert, relate need T extends Values
create<T extends Values>(table: Table): Creator<T>
insert<T extends Values>(table: Table): Inserter<T>
update<T extends Values>(thing: RecordId): Updater<T>
upsert<T extends Values>(thing: RecordId): Upsertor<T>
relate<T extends Values>(thing: RecordId): Relater<T>
```

**Why?** These methods accept data that will become a record. The `id` field shouldn't be in the input - SurrealDB generates it.

##### Where T Can Be Any Type

Methods that return data can use any type:

```ts
// select, delete just return what they find
select<T>(thing: RecordId): Promise<RecordResult<T> | null>
delete<T>(thing: RecordId): Promise<RecordResult<T> | null>

// live streams any record type
live<T>(table: Table): LiveSelect<T>

// run returns any function return type
run<T>(name: string, ...args: unknown[]): Promise<T>
```

---

#### Type Inference

TypeScript often infers the generic type from arguments, reducing the need for explicit type parameters.

**Inference from select():**

```ts
const user = await db.select(new RecordId('users', 'john'));
// TypeScript infers: RecordResult<unknown>

// Provide your type for better typing
const user = await db.select<User>(new RecordId('users', 'john'));
// TypeScript knows: RecordResult<User>
```

**Inference from .content():**

```ts
const created = await db.create<User>(new Table('users')).content({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});
// TypeScript knows the shape from the content object
```

**Inference from .merge():**

```ts
const merged = await db.update<User>(new RecordId('users', 'john')).merge({
  name: 'John',
});
// TypeScript knows user still has all fields, just updated name
```

---

#### Practical Examples with Interfaces

Complete examples showing the full flow with a User interface:

```ts
interface User {
  name: string;
  email: string;
  age: number;
}

// select - retrieve a user
const user = await db.select<User>(new RecordId('users', 'john'));
// Type: RecordResult<User> | null
if (user) {
  console.log(user.id); // RecordId: "users:john"
  console.log(user.name); // "string
}

// create - add a new user
const created = await db.create<User>(new Table('users')).content({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});
// Type: RecordResult<User>
console.log(created.id); // RecordId: "users:..."

// insert - add multiple users
const inserted = await db.insert<User>(new Table('users')).bulk([
  { name: 'John', email: 'john@example.com', age: 30 },
  { name: 'Jane', email: 'jane@example.com', age: 25 },
]);
// Type: RecordResult<User>[]

// update - modify a user (full replacement)
const updated = await db.update<User>(new RecordId('users', 'john')).content({
  name: 'John Updated',
  email: 'newemail@example.com',
  age: 31,
});
// Type: RecordResult<User>

// update - modify a user (partial update)
const merged = await db.update<User>(new RecordId('users', 'john')).merge({
  name: 'John Merged',
});
// Type: RecordResult<User>

// upsert - create or replace
const upserted = await db.upsert<User>(new RecordId('users', 'john')).content({
  name: 'John',
  email: 'john@example.com',
  age: 30,
});
// Type: RecordResult<User>

// delete - remove a user
const deleted = await db.delete<User>(new RecordId('users', 'john'));
// Type: RecordResult<User> | null

// relate - create a relationship
interface Follow {
  since: Date;
}
const related = await db.relate<Follow>(new RecordId('follows', 'rel')).content({
  in: new RecordId('users', 'john'),
  out: new RecordId('users', 'jane'),
  since: new Date(),
});
// Type: RecordResult<Follow>

// live - subscribe to real-time updates
const unsub = await db.live<User>(new Table('users')).subscribe((msg) => {
  console.log(msg.action); // 'CREATE' | 'UPDATE' | 'DELETE'
  console.log(msg.data); // RecordResult<User>
});
// When done: unsub()

// query - custom SurrealQL
const result = await db.query<User[]>('SELECT * FROM users WHERE age > $minAge', {
  minAge: 18,
});
// result: QueryResponse<User[]>

// run - execute a defined function
await db.query(`DEFINE FUNCTION fn::get_user_by_email($email) {
  RETURN (SELECT * FROM users WHERE email = $email)[0]
}`);
const found = await db.run<User>('fn::get_user_by_email', 'john@example.com');
// Type: User (raw, not wrapped in RecordResult)
```

---

#### Api Type Parameter

```ts
// User-defined API
type MyApi = {
  '/users': { get: [void, User[]] };
  '/users/:id': { get: [void, User] };
  '/users': { post: [CreateUserInput, User] };
};

const api = db.api<MyApi>('/api');

// GET /users
const users = await api.get('/users');

// GET /users/:id
const user = await api.get('/users/:id', { params: { id: 'john' } });

// POST /users
const created = await api.post('/users', { params: { name: 'John' } });
```

---

### Union Types

#### AuthProvider Union

```ts
type AuthProvider = SystemAuth | NamespaceAuth | DatabaseAuth | AccessRecordAuth | Tokens;
```

#### LiveResource Union

```ts
type LiveResource = Table | RecordId | RecordIdRange;
```

#### AnyAuth Union

```ts
type AnyAuth = SystemAuth | NamespaceAuth | DatabaseAuth | AccessRecordAuth;
```

#### Values Union

```ts
type Values =
  | boolean
  | number
  | string
  | null
  | undefined
  | Date
  | Array<Values>
  | Record<string, Values>
  | Set<Values>
  | Uint8Array
  | RecordId
  | DateTime
  | Duration
  | Decimal
  | Uuid
  | Geometry;
```

---

## Extensibility Points

### Custom Codecs

```ts
const db = new Surreal({
  codecs: {
    custom: {/* codec factory */},
  },
  codecOptions: {
    valueEncodeVisitor: (value) => value,
    valueDecodeVisitor: (value) => value,
  },
});
```

### Custom Engines

```ts
const db = new Surreal({
  engines: {
    myprotocol: (connection) => ({/* engine implementation */}),
  },
});
```

### Custom WebSocket

```ts
const db = new Surreal({
  websocketImpl: MyWebSocket,
});
```

### Custom Fetch

```ts
const db = new Surreal({
  fetchImpl: myFetch,
});
```

### User-Defined APIs

```ts
// Define type-safe API
type MyPaths = {
  '/users': { get: [void, User[]] };
  [key: `/users/${string}`]: { get: [void, User] };
};

const api = db.api<MyPaths>('/api');
const users = await api.get('/users');
const user = await api.get('/users/1');
```

---

## Quick Reference

### Basic Setup

```ts
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('ws://localhost:8000');
await db.use({ namespace: 'test', database: 'test' });

// Query
const users = await db.select(new Table('users'));

// Close
await db.close();
```

### With Authentication

```ts
await db.connect('ws://localhost:8000', {
  namespace: 'test',
  database: 'test',
  authentication: {
    username: 'root',
    password: 'root',
  },
});
```

### With Embedded Engine

```ts
import { createNodeEngines } from '@surrealdb/node';

const db = new Surreal({
  engines: {
    ...createRemoteEngines(),
    ...createNodeEngines(),
  },
});

await db.connect('mem://');
```
