# @woss/dali-memory

SurrealDB-backed memory plugin for OpenCode. Provides persistent memory with semantic search, fact extraction, session tracking, and message history for AI agents.

## Features

- **Persistent memory** — store and retrieve agent memories across sessions
- **Semantic search** — vector-based similarity search via embeddings
- **Facts** — structured knowledge extraction and verification
- **Session tracking** — automatic session creation, updates, and model association
- **Message history** — capture user and agent messages per session
- **Two storage modes** — embedded (local) or remote SurrealDB
- **Two embedding providers** — local HuggingFace pipeline or remote API
- **DaliORM integration** — type-safe schema, migrations, query builders
- **OpenCode plugin** — tool-based memory operations + lifecycle hooks

## Architecture

```
dali-memory/
├── src/
│   ├── index.ts              # Entry (empty export)
│   ├── opencode.ts           # OpenCode plugin definition
│   ├── schema.ts             # DaliORM schema (12 tables)
│   ├── config.ts             # Configuration loading + Zod validation
│   ├── constants.ts          # Plugin name constant
│   ├── commands/
│   │   └── commands.ts       # CLI command templates
│   ├── embedder/
│   │   ├── embedder.ts       # EmbedderService (provider dispatch)
│   │   ├── schemas.ts        # Embedder config + result Zod schemas
│   │   ├── local-provider.ts # HuggingFace Transformers pipeline
│   │   └── remote-provider.ts# OpenAI-compatible API client
│   ├── tools/
│   │   ├── hooks.ts          # session.compacting + chat.message hooks
│   │   ├── events.ts         # session.created/updated/compacted events
│   │   ├── memory-tool.ts    # dali_memory tool executor
│   │   ├── migrate-tool.ts   # dali_migrate_oc_db tool executor
│   │   └── types.ts          # Shared type definitions
│   └── utils/
│       ├── argsParsing.ts    # Zod argument validation + rehydration
│       ├── logger.ts         # LogTape logger (file rotation)
│       ├── memory-service.ts # MemoryService (business logic layer)
│       └── surreal-client.ts # SurrealClient (DaliORM data access)
├── migrations/               # DaliORM migration files
├── scripts/
│   └── generate-schema.ts    # JSON Schema generation script
└── dali-memory.schema.json   # Generated JSON Schema for config
```

### Data Flow

```
OpenCode Plugin
    │
    ├── tool(dali_memory) ──► MemoryTool ──► MemoryService ──► SurrealClient ──► DaliORM ──► SurrealDB
    │
    ├── tool(dali_migrate_oc_db) ──► MigrateTool ──► MemoryService ──► SurrealClient.applyPendingMigrations()
    │
    ├── chat.message hook ──► MemoryService.saveMessage()
    │
    ├── session.compacting hook ──► injects FACT: prompt into output
    │
    └── event handler ──► session.created → upsertSession()
                          session.updated → updateSession()
                          session.compacted → injectFactExtraction()
```

## Installation

```bash
pnpm add @woss/dali-memory
```

## Configuration

Configuration is loaded from two locations (merged, project overrides user):

1. **User config**: `~/.config/dali-memory/dali-memory.jsonc` or `.json`
2. **Project config**: `<project>/.opencode/dali-memory.jsonc` or `.json`

### Default config

```jsonc
{
  "storage": {
    "mode": "embed",
    "embed": {
      "engine": "surrealkv",
      "dataPath": "~/.config/dali-memory/data/",
    },
  },
  "embedding": {
    "provider": "remote",
    "endpoint": "http://localhost:1234/v1",
    "model": "text-embedding-qwen3-embedding-4b",
  },
}
```

### Configuration schema

| Path                           | Type                        | Description                                                   |
| ------------------------------ | --------------------------- | ------------------------------------------------------------- |
| `storage.mode`                 | `"embed"` \| `"remote"`     | Storage backend                                               |
| `storage.embed.engine`         | `"surrealkv"` \| `"memory"` | Embedded engine (persistent or in-memory)                     |
| `storage.embed.dataPath`       | `string`                    | Path for embedded data (~ expanded)                           |
| `storage.remote.url`           | `string`                    | Remote SurrealDB URL (ws:// or http://)                       |
| `storage.remote.auth.username` | `string`                    | Remote auth username                                          |
| `storage.remote.auth.password` | `string`                    | Remote auth password (supports `env://` / `file://` prefixes) |
| `storage.remote.namespace`     | `string`                    | SurrealDB namespace                                           |
| `storage.remote.database`      | `string`                    | SurrealDB database                                            |
| `embedding.provider`           | `"remote"` \| `"local"`     | Embedding provider                                            |
| `embedding.endpoint`           | `string`                    | API endpoint (remote) or cache dir (local)                    |
| `embedding.model`              | `string`                    | Model ID or HuggingFace model name                            |
| `embedding.apiKey`             | `string`                    | API key (supports `env://` / `file://` prefixes)              |
| `embedding.modelCacheDir`      | `string`                    | Local model cache directory                                   |
| `plugin.chatMessage.enabled`   | `boolean`                   | Capture chat messages                                         |
| `plugin.autoCapture.enabled`   | `boolean`                   | Auto-capture from session activity                            |

## Schema

12 tables defined via DaliORM in `src/schema.ts`:

### Tables

| Table        | Type    | Description                                                    |
| ------------ | ------- | -------------------------------------------------------------- |
| `memories`   | `TABLE` | Persistent memories with vector embeddings, tags, content hash |
| `embeddings` | `TABLE` | Embedding dimension/model metadata                             |
| `facts`      | `TABLE` | Structured knowledge facts (verified/unverified)               |
| `projects`   | `TABLE` | Project registrations (unique by directory_path)               |
| `sessions`   | `TABLE` | OpenCode session records                                       |
| `messages`   | `TABLE` | Per-session chat messages                                      |
| `models`     | `TABLE` | AI model records (unique by provider_id + model_id)            |

### Relation tables

| Table             | Direction               | Description                 |
| ----------------- | ----------------------- | --------------------------- |
| `part_of_project` | `projects → memories`   | Memory belongs to project   |
| `part_of_session` | `sessions → memories`   | Memory belongs to session   |
| `has_embedding`   | `embeddings → memories` | Memory has vector embedding |
| `relates_to`      | `facts → memories`      | Fact relates to memory      |
| `uses_model`      | `sessions → models`     | Session uses model          |

### Entity relationships

```
projects ──→ part_of_project ──→ memories ──→ has_embedding ──→ embeddings
sessions ──→ part_of_session ──→ memories
facts ────→ relates_to ──→ memories
sessions ──→ uses_model ──→ models
sessions ──── messages (record field)
```

## Storage Modes

### Embedded (`mode: "embed"`)

Runs SurrealDB embedded in-process. Two engines:

- **`surrealkv`** (default) — persistent, file-based. Data stored at configured `dataPath`.
- **`memory`** — in-memory only. Resets on restart. Useful for testing.

```jsonc
{
  "storage": {
    "mode": "embed",
    "embed": {
      "engine": "surrealkv",
      "dataPath": "~/.config/dali-memory/data/",
    },
  },
}
```

### Remote (`mode: "remote"`)

Connects to an external SurrealDB server via WebSocket.

```jsonc
{
  "storage": {
    "mode": "remote",
    "remote": {
      "url": "ws://localhost:10101",
      "auth": {
        "username": "root",
        "password": "env://SURREALDB_PASSWORD",
      },
      "namespace": "memory",
      "database": "memory",
    },
  },
}
```

## Embedding Providers

### Remote provider

Calls an OpenAI-compatible embeddings API (e.g., llama.cpp, vLLM, OpenAI).

```jsonc
{
  "embedding": {
    "provider": "remote",
    "endpoint": "http://localhost:1234/v1",
    "model": "text-embedding-qwen3-embedding-4b",
    "apiKey": "file:///path/to/key",
  },
}
```

Features:

- LRU cache (100 entries) with eviction
- 30-second request timeout
- API key via `env://` or `file://` prefixes

### Local provider

Runs HuggingFace Transformers via `@huggingface/transformers` (ONNX runtime).

```jsonc
{
  "embedding": {
    "provider": "local",
    "model": "Xenova/bge-large-en-v1.5",
    "modelCacheDir": "~/.config/dali-memory/model_cache/",
  },
}
```

Features:

- Mean pooling + L2 normalization
- Model cached to disk after first download
- Default model: `Xenova/bge-large-en-v1.5` (1024 dimensions)

## OpenCode Plugin

The plugin registers itself as `DaliMemoryPlugin` and hooks into OpenCode lifecycle:

### Tools

| Tool                 | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `dali_memory`        | CRUD for memories + facts. Validated via Zod schema.        |
| `dali_migrate_oc_db` | Apply pending migration files from `migrations/` directory. |

### Commands

| Command              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `dali_migrate_oc_db` | Runs the migrate tool (subtask).                                        |
| `dali_remember`      | Proxy to `dali_memory` tool with argument forwarding (subtask).         |
| `dali_extract_facts` | Instructs agent to extract knowledge facts from conversation (subtask). |
| `noop`               | No-op command for termination.                                          |

### Hooks

- **`chat.message`** — captures user and agent text from each message, persists to `messages` table.
- **`experimental.session.compacting`** — injects a fact-extraction prompt into the compaction summary context, instructing the agent to output `FACT: <statement>` lines.

### Events

- **`session.created`** — upserts session record, creates model record, links model to session via `uses_model` relation.
- **`session.updated`** — updates session title/slug, upserts model, re-links.
- **`session.compacted`** — injects fact extraction prompt into the session via `client.session.prompt()`.

### Plugin initialization flow

```
Plugin load
  └─► memoryService.initialize(directory)
        ├── initConfig(directory)          # Load user + project config
        ├── embeddingService.configure()   # Initialize embedding provider
        ├── surrealClient.connect()        # Connect to SurrealDB + apply migrations
        └─► getOrCreateProject()           # Register project by directory path
              └─► projectId stored in memoryService.projectId
```

## Memory Tool

The `dali_memory` tool supports multiple modes:

### Memory operations

| Mode     | Args                                  | Description                                   |
| -------- | ------------------------------------- | --------------------------------------------- |
| `add`    | `content`, `tags?`, `type?`, `scope?` | Store memory with auto-generated embedding    |
| `search` | `query`, `tags?`, `scope?`            | Semantic search by vector similarity (cosine) |
| `list`   | `scope?`                              | List recent memories (limit 50)               |
| `forget` | `id`                                  | Delete memory by ID                           |
| `help`   | —                                     | Show available modes                          |

### Fact operations

| Mode          | Args                   | Description                                     |
| ------------- | ---------------------- | ----------------------------------------------- |
| `fact_add`    | `content`, `memoryId?` | Store knowledge fact, optionally link to memory |
| `fact_list`   | `memoryId`             | List facts linked to a memory                   |
| `fact_verify` | `factId`               | Mark fact as verified                           |

### Scoping

The `scope` parameter controls which container tag to use:

- `"project"` (default) — scope to the current project directory
- `"all-projects"` — scope to the current user across all projects

Tags are generated deterministically:

- **User tag**: `opencode_user_<sha256(git_email)[:16]>`
- **Project tag**: `opencode_project_<sha256(directory_path)[:16]>`

### Memory deduplication

Memories are content-deduplicated via:

1. `content_hash` column with `DEFAULT crypto::blake3(content)`
2. Unique index `idx_memories_content_hash`
3. On duplicate: catches the constraint violation and selects the existing record by content instead

## Migrations

The `migrations/` directory contains 12 migration files covering schema evolution:

```bash
20260513162005_init/
20260513162020_embedding/
20260513162917_rm-user-embed/
20260513232107_add/
20260513235512_uses_model/
20260514001453_uses_model_idx/
20260514150050_add_indexes/
20260514151644_add-content-hash/
20260514162212_add_variant_to_model/
20260514174946_cleanup_session/
20260514182642_add_index_to_partofproject/
20260515183000_content_hash_blake3/
```

Migrations auto-apply on connect via `migrateToDatabase()`. Run manually with the `dali_migrate_oc_db` tool or via CLI:

```bash
dali-orm migrate dev
```

## Logging

Uses LogTape with rotating file sink. Configuration via environment variables:

| Variable                        | Default                                      | Description                                 |
| ------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `DALI_MEMORY_LOGGING_LEVEL`     | `info`                                       | Log level: `debug`, `info`, `warn`, `error` |
| `DALI_MEMORY_LOGGING_ENABLED`   | `true`                                       | Set to `false` to disable file logging      |
| `DALI_MEMORY_LOGGING_FILE_PATH` | `~/.config/dali-memory/logs/dali-memory.log` | Log file path                               |

Log rotation: 5 files × 10MB each.

## Scripts

| Script                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `pnpm build`            | Build (generates JSON Schema + bundles)            |
| `pnpm test`             | Run unit tests                                     |
| `pnpm test:all`         | Run all tests (unit + integration, no parallelism) |
| `pnpm test:integration` | Run integration tests only                         |
| `pnpm orm`              | Proxy to `dali-orm` CLI                            |

## Development

```bash
# Build
pnpm build

# Tests
pnpm test
pnpm test:all       # includes integration tests
pnpm test:integration

# Generate JSON Schema (from Zod config schema)
pnpm generate:schema

# Run migrations directly
pnpm orm migrate dev
```

## Integration testing

Integration tests in `src/__tests__/*.integration.test.ts` connect to an embedded SurrealDB in `memory` mode. They validate:

- `memories` CRUD with vector search
- Session lifecycle (create → update → model linking)
- Message persistence
- Project registration
- Fact save/verify/retrieval
- Full memory save → search → delete flow

## Dependencies

| Package                     | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `@opencode-ai/plugin`       | OpenCode plugin interface                  |
| `@opencode-ai/sdk`          | OpenCode SDK types (events)                |
| `@woss/dali-orm`            | DaliORM schema, query builders, migrations |
| `@surrealdb/node`           | SurrealDB embedded driver                  |
| `surrealdb`                 | SurrealDB client                           |
| `@huggingface/transformers` | Local embedding inference (ONNX)           |
| `zod`                       | Schema validation                          |
| `@logtape/logtape`          | Logging framework                          |
| `@logtape/file`             | Rotating file sink                         |
| `jsonc-parser`              | JSONC config file parsing                  |

## License

GPL-3.0-only
