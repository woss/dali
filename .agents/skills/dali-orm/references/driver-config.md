# Driver Configuration

Connection types and configuration for SurrealDB.

## SurrealDriver Interface

```typescript
interface SurrealDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  use(ns: string, db: string): Promise<void>;
  query<T>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
  select<T>(thing: string): Promise<T[]>;
  insert<T>(table: string, data: T | T[]): Promise<T[]>;
  update<T>(thing: string, data: unknown): Promise<T[]>;
  delete<T>(thing: string): Promise<T[]>;
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}
```

## NodeDriver (WebSocket/HTTP)

Connects to a remote SurrealDB server:

```typescript
import { DaliORM } from '@woss/dali-orm';

const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101', // WebSocket URL
    namespace: 'myns',
    database: 'mydb', // Optional (can .use() later)
    auth: {
      type: 'root', // 'root' | 'scope' | 'token' | 'jwt'
      username: 'root',
      password: 'root',
    },
    tls: false, // Enable TLS
    driverOptions: {
      ws: { pingInterval: 30000, pingTimeout: 5000 },
      http: { strict: false, timeout: 30000 },
    },
  },
});
```

## EmbeddedDriver (In-Process)

Runs SurrealDB embedded in the same process:

```typescript
const orm = await DaliORM.connect({
  embeddedDriver: {
    driver: 'embedded', // Required
    path: '/data/mydb', // Database file path
    mode: 'surrealkv', // Storage backend
    // 'memory' for in-memory only
  },
});
```

## Auth Types

| Auth Type | Fields                                            |
| --------- | ------------------------------------------------- |
| `root`    | `username`, `password`                            |
| `scope`   | `namespace`, `database`, `access` (+ `variables`) |
| `token`   | `access` (bearer token in variables)              |
| `jwt`     | `access` (JWT in variables)                       |

```typescript
// Scope auth
const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'app',
    database: 'app',
    auth: {
      type: 'scope',
      namespace: 'app',
      database: 'app',
      access: 'user_scope',
      variables: { email, password },
    },
  },
});
```

## Reconnect Options

```typescript
const orm = await DaliORM.connect({
  nodeDriver: { url: 'ws://localhost:10101', ... },
  reconnect: {
    retries: 5,           // Number of retry attempts
    delay: 1000,          // Initial delay in ms
    maxDelay: 30000,      // Maximum delay in ms
    backoff: 'exponential', // 'exponential' | 'linear' | 'fixed'
  },
});
```

## Config File Loading

```typescript
// Automatically load config file
const orm = await DaliORM.connect({ config: true });

// Load specific config file
const orm = await DaliORM.connect({ config: './custom.config.ts' });

// Skip config file, explicit config only
const orm = await DaliORM.connect({
  nodeDriver: { ... },  // no config option
});
```

Config file formats:

| File Name               | Type               |
| ----------------------- | ------------------ |
| `.dali-orm.json`        | JSON               |
| `.dali-orm.jsonc`       | JSON with comments |
| `.dali-orm.ts`          | TypeScript         |
| `dali-orm.config.json`  | JSON               |
| `dali-orm.config.jsonc` | JSON with comments |
| `dali-orm.config.ts`    | TypeScript         |

## Codec Options

```typescript
const orm = await DaliORM.connect({
  nodeDriver: { url: 'ws://localhost:10101', ... },
  codecOptions: {
    // Custom encoding/decoding options
  },
});
```

## Important Notes

- **Always check `isConnected()`** before queries. Use `checkConnection()` guard pattern.
- **Do NOT hardcode credentials** — use `.env` file with `dotenvx`.
- **Embedded driver** uses filesystem path for persistence; `mode: 'memory'` is ephemeral.
- **Reconnect is enabled by default** with exponential backoff.
- Use `orm.getDriver()` to access the low-level driver for `pushSchemaFromTableDefs` and other migration APIs.
