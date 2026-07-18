# @woss/dali-memory

Standalone MCP memory server with SurrealDB, hybrid search, and Web UI.

## Features

- Persistent memory storage via SurrealDB
- Hybrid search (BM25 fulltext + vector cosine similarity, RRF fusion)
- Two embedding providers: local (transformers.js, ONNX) and remote (OpenAI-compatible API)
- MCP protocol server for AI agent integration (4 tools: memories_store, memories_search, tags_add, tags_remove)
- SvelteKit Web UI with glass morphism design
- Auth: session cookie-based web auth + API key auth for MCP
- Tag system for memory organization
- Content deduplication
- Content chunking — long content (>1500 chars) auto-split into overlapping chunks by heading→paragraph→line→sentence hierarchy, each chunk independently embedded for granular search
- daisyUI / Tailwind v4 styling
- DaliORM for type-safe schema, migrations, query builders

## Architecture

```
dali-memory/
├── src/
│   ├── app.html                # SvelteKit HTML shell with Google Fonts (Space Grotesk, DM Sans)
│   ├── app.css                 # Tailwind v4 + daisyUI 5.6.14 + custom @utility classes + glass morphism + animations
│   ├── app.d.ts                # App.Locals type (authenticated, userEmail)
│   ├── hooks.server.ts         # Auth handle hook (HMAC-signed session cookies)
│   ├── hooks.server.test.ts    # Auth hook tests
│   ├── lib/server/
│   │   ├── config.ts           # Zod env var schema (DALI_MEMORY_* vars)
│   │   ├── errors.ts           # Typed error hierarchy: MemoryError, TagError, WorkspaceError (extends DaliOrmError)
│   │   ├── logger.ts           # LogTape with console + rotating file sinks
│   │   ├── chunking/
│   │   │   ├── index.ts        # Hierarchical content chunker (heading→paragraph→line→sentence)
│   │   │   └── __tests__/index.test.ts
│   │   ├── db/
│   │   │   ├── schema.ts       # 9-table DaliORM schema (workspaces, memories, embeddings, models, tags, memory_tags, api_keys, users + has_embedding relation)
│   │   │   ├── connection.ts   # DaliORM connect/disconnect, auto-migration on startup
│   │   │   └── __tests__/connection.test.ts
│   │   ├── embedder/
│   │   │   ├── types.ts        # EmbedderResult, EmbedderProvider interface
│   │   │   ├── index.ts        # EmbedderService (provider dispatch)
│   │   │   ├── local.ts        # LocalEmbedder — HuggingFace Transformers.js pipeline
│   │   │   └── remote.ts       # RemoteEmbedder — OpenAI-compatible API
│   │   ├── auth/
│   │   │   └── api-keys.ts     # API key hashing (SHA-256 + secret salt), validation, last_used_at touch
│   │   ├── services/
│   │   │   ├── types.ts        # MemoryRecord, TagRecord, SearchResult, SearchOptions
│   │   │   ├── memory.ts       # MemoryService — CRUD, vector search, listAllMemories (cross-workspace), auto-chunking on create/update
│   │   │   ├── tag.ts          # TagService — create, find, list, attach/detach, union/intersect queries
│   │   │   └── hybrid-search.ts # HybridSearch — RRF fusion of BM25 fulltext + cosine vector
│   │   └── mcp.ts              # MCP server (4 tools) via @modelcontextprotocol/sdk
│   ├── routes/
│   │   ├── +page.server.ts     # Home — stats dashboard (memories/workspaces/tags counts)
│   │   ├── +page.svelte        # Home hero glass card + stat cards
│   │   ├── +layout.server.ts   # Loads defaultWorkspaceId + workspaces list for all pages
│   │   ├── +layout.svelte      # Glass navbar + page shell + ToastContainer
│   │   ├── memories/               # Global memory list (all workspaces) with tag filter, workspace badges
│   │   │   ├── +page.server.ts     # Loads all memories via listAllMemories(), fetches tags per memory, batch-fetches workspace names
│   │   │   └── +page.svelte        # Glass card memory list with tag filter, workspace badge linking to workspace
│   │   ├── login/              # Email/password form → HMAC-signed cookie
│   │   ├── register/           # Email/password/confirm → creates users + personal workspace
│   │   ├── logout/             # Clears cookie, redirects to /login
│   │   ├── workspaces/             # Workspace CRUD with glass cards
│   │   │   └── [id]/memories/
│   │   │       ├── +page.server.ts  # Workspace-scoped memory list with search, tag filter, pagination, CRUD
│   │   │       ├── +page.svelte     # Staggered memory glass cards, search bar, tag pills
│   │   │       └── [slug]/
│   │   │           ├── +page.server.ts  # Workspace-scoped detail — verifies workspace membership, tag management
│   │   │           └── +page.svelte     # Detail page with edit form, tags, delete, workspace-back link
│   │   ├── settings/           # Config display + API key management (generate/delete) + profile section (name/email update)
│   │   └── api/mcp/+server.ts  # MCP SSE endpoint (GET → SSE stream, POST → JSON-RPC)
│   └── lib/
│       ├── components/
│       │   ├── toast.svelte.ts      # Toast store — $state reactive array, addToast/removeToast, toast.success/error/info/warning
│       │   ├── Toast.svelte         # Single toast — daisyUI alert, icon by type, auto-dismiss progress bar, manual close
│       │   └── ToastContainer.svelte# Fixed bottom-right stack, renders up to 5 toasts with pointer-events isolation
│       └── utils/serialization.ts   # toPlain() helper
├── vite.config.ts               # SvelteKit + Tailwind v4 + SSR external for @woss/dali-orm
├── svelte.config.js             # adapter-node, CSRF trusted origins *
└── package.json                 # deps: @woss/dali-orm, surrealdb, @huggingface/transformers, @modelcontextprotocol/sdk, daisyui, tailwindcss, zod, @logtape/logtape
```

## Configuration

All config via environment variables, validated by Zod.

| Variable                        | Default                  | Description                                 |
| ------------------------------- | ------------------------ | ------------------------------------------- |
| DALI_MEMORY_EMBEDDING_PROVIDER  | remote                   | local or remote                             |
| DALI_MEMORY_EMBEDDING_MODEL     | all-MiniLM-L6-v2         | Model ID (HuggingFace or OpenAI-compatible) |
| DALI_MEMORY_EMBEDDING_DIMENSION | 384                      | Vector dimension                            |
| DALI_MEMORY_EMBEDDING_ENDPOINT  | http://localhost:1234/v1 | OpenAI-compatible API URL (remote)          |
| DALI_MEMORY_EMBEDDING_API_KEY   | -                        | API key for remote provider                 |
| DALI_MEMORY_EMBEDDING_CACHE_DIR | ./models                 | Model cache for local provider              |
| DALI_MEMORY_SURREAL_URL         | ws://localhost:10101     | SurrealDB WebSocket URL                     |
| DALI_MEMORY_SURREAL_NS          | memory                   | SurrealDB namespace                         |
| DALI_MEMORY_SURREAL_DB          | memory                   | SurrealDB database                          |
| DALI_MEMORY_SURREAL_USER        | root                     | DB user                                     |
| DALI_MEMORY_SURREAL_PASS        | root                     | DB password                                 |
| DALI_MEMORY_SECRET              | (required)               | HMAC secret for session cookies             |
| DALI_MEMORY_AUTH_ENABLED        | true                     | Enable auth (set false for dev)             |
| DALI_MEMORY_PORT                | 5173                     | SvelteKit port                              |
| DALI_MEMORY_HOST                | 0.0.0.0                  | Bind address                                |
| DALI_MEMORY_MCP_SSE_PATH        | /mcp                     | MCP SSE endpoint path                       |
| DALI_MEMORY_LOG_LEVEL           | info                     | debug/info/warn/error                       |

## Schema

9 tables and relations defined via DaliORM in `src/lib/server/db/schema.ts`:

### Tables

| Table      | Type  | Description                                                                                                                                                                                   |
| ---------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspaces | TABLE | name (unique), description, is_personal, user_id → users (optional), created_at                                                                                                               |
| memories   | TABLE | name, content, memory_type (default "fact"), metadata, workspace_id → workspaces, created_at. Unique indexes on (name, ws) and (content, ws). Fulltext index on content (fts_ascii analyzer). |
| embeddings | TABLE | vector, model → models, dimensions, chunk_index (optional), chunk_text (optional), section (optional), created_at                                                                             |
| models     | TABLE | provider_id, model_id, variant (optional), dimensions, created_at. Unique index on (provider_id, model_id).                                                                                   |
| tags       | TABLE | name (unique)                                                                                                                                                                                 |
| api_keys   | TABLE | key_hash (unique), name, created_at, last_used_at (optional), user_id → users (optional)                                                                                                      |
| users      | TABLE | email (unique), pass, name, default_workspace_id → workspaces (optional), created_at                                                                                                          |

### Relations

| Table         | Direction             | Description                            |
| ------------- | --------------------- | -------------------------------------- |
| has_embedding | embeddings → memories | Memory has vector embedding            |
| memory_tags   | memories → tags       | Memory-to-tag assignment (unique pair) |

### Access

| Name        | Type   | Details                                                           |
| ----------- | ------ | ----------------------------------------------------------------- |
| user_access | RECORD | SIGNUP/SIGNIN with crypto::argon2, 30d session duration, 1h token |

### Analyzers

| Name      | Tokenizers | Filters          |
| --------- | ---------- | ---------------- |
| fts_ascii | class      | ascii, lowercase |

## Embedding Providers

### Remote (default)

Calls OpenAI-compatible API (`/embeddings` endpoint). Supports batch embedding.

```ts
config = {
  DALI_MEMORY_EMBEDDING_PROVIDER: 'remote',
  DALI_MEMORY_EMBEDDING_ENDPOINT: 'http://localhost:1234/v1',
  DALI_MEMORY_EMBEDDING_MODEL: 'all-MiniLM-L6-v2',
  DALI_MEMORY_EMBEDDING_API_KEY: 'sk-...',
};
```

- Sends `Authorization: Bearer` header when API key is configured
- Sends single or batched input to the `/embeddings` endpoint
- Reads embedding from `json.data[0].embedding`

### Local

Runs `@huggingface/transformers` via ONNX runtime.

```ts
config = {
  DALI_MEMORY_EMBEDDING_PROVIDER: 'local',
  DALI_MEMORY_EMBEDDING_MODEL: 'all-MiniLM-L6-v2',
  DALI_MEMORY_EMBEDDING_CACHE_DIR: './models',
};
```

- Pipeline type: `feature-extraction`
- Mean pooling + L2 normalization
- Model auto-downloaded and cached to disk
- Lazy initialization on first `embed()` call

Both providers configurable via `DALI_MEMORY_EMBEDDING_MODEL`. Schema supports multiple models via `models` table.

## Hybrid Search

RRF (Reciprocal Rank Fusion) combining:

1. **Vector search** via `vector::similarity::cosine()` against stored embeddings
2. **Fulltext search** via `search::score()` on `idx_memories_content_ft`

Configurable weights (default: 0.5 each) and RRF constant K (default: 60). Results labeled with `matched_on`: `vector` / `fulltext` / `both`.

**Chunk-aware:** `MemoryService.searchSimilar()` traverses the `has_embedding` edge from chunk embeddings to parent memories and deduplicates by memory, keeping only the highest-scoring chunk per memory. This prevents a single memory from dominating results while still leveraging granular chunk-level matching.

## MCP Server

Exposed at `GET /api/mcp` (SSE stream) and `POST /api/mcp` (JSON-RPC) via `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`.

### Tools

| Tool            | Input                                                | Description                                                                                                                   |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| memories_store  | name, content, workspace_id, memory_type?, metadata? | Create memory with auto-embedding; content >1500 chars is auto-chunked into overlapping segments, each embedded independently |
| memories_search | query, workspace_id?, limit?, threshold?             | Hybrid search (fulltext + vector, RRF fusion)                                                                                 |
| tags_add        | memory_id, tag_name                                  | Create tag + attach to memory                                                                                                 |
| tags_remove     | memory_id, tag_name                                  | Detach tag from memory                                                                                                        |

### Auth

Bearer token validated against `api_keys` table. Key is SHA-256 hashed with secret salt (`crypto.subtle.digest('SHA-256', key + secret)`). Comparison is a constant-time hash lookup. `last_used_at` updated fire-and-forget on each validated request. Gate-kept by `DALI_MEMORY_AUTH_ENABLED`.

## Web UI

SvelteKit with Tailwind v4 + daisyUI 5.6.14, hard-coded dark theme (`data-theme="dark"` on `<html>`).

### Design System

- **Heading**: Space Grotesk (Google Fonts, weights 400-700)
- **Body**: DM Sans (weights 300-700, optical sizing 9-40)
- **Primary**: Amber #f59e0b, **Secondary**: Cyan #06b6d4, **Accent**: Purple #8b5cf6
- **Background**: Dark brown #1c1917 with 3 radial-gradient mesh + SVG noise overlay
- **Cards**: Glass morphism (`backdrop-filter: blur(16px)`, 60% opaque bg, subtle border glow)
- **Animations**: fadeIn (500ms), slideUp (500ms), slideDown (300ms), scaleIn (400ms), staggered delays 100-600ms

### Custom Tailwind v4 @utility Classes

Defined in `app.css` using the `@utility` directive (Tailwind v4 native):

| Utility            | Purpose                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `glass-card`       | Glass morphism card — blurred backdrop, semi-transparent bg, subtle border glow, rounded corners, shadow |
| `skeleton-text`    | Placeholder text shimmer — animated gradient skeleton with rounded corners                               |
| `text-2line-clamp` | Clamp text to 2 lines with ellipsis                                                                      |
| `card-hover-3d`    | 3D perspective tilt on hover — slight X/Y rotation + lift                                                |
| `btn-rotate-hover` | Button scale(1.1) + rotate(3deg) on hover                                                                |
| `fade-in`          | Opacity 0→1 over 500ms, `forwards` fill                                                                  |
| `slide-up`         | Opacity 0→1 + translateY(20px)→0 over 500ms                                                              |
| `shimmer`          | Repeating skeleton-shimmer gradient animation (1.5s infinite)                                            |

### Toast Notification System

Built-in toast system backed by a Svelte 5 `$state` reactive store — no external dependencies.

**Usage:**

Uses [svelte-sonner](https://github.com/wobsoriano/svelte-sonner) for toast notifications. The `<Toaster />` component is placed in `+layout.svelte`.

```ts
import { toast } from 'svelte-sonner';

toast.success('Memory saved');
toast.error('Failed to delete', 5000);
toast.info('Processing...');
toast.warning('Disk space low');
```

- `toast.success(msg, duration?)` — green success toast
- `toast.error(msg, duration?)` — red error toast
- `toast.info(msg, duration?)` — blue info toast
- `toast.warning(msg, duration?)` — yellow warning toast
- Default `duration`: 3000ms
- Manual close via X button
- `<Toaster />` in `+layout.svelte` makes toasts available on every page

### Pages

| Route                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /                                | Home hero with gradient heading glow + 3 stat cards (memories, workspaces, tags)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| /memories                        | Global memory list (all workspaces) — staggered glass cards, tag filter (pills), workspace name badge linking to workspace, title links to individual memory page. Debounced search input (no explicit Search button), create modal, delete confirmation dialog                                                                                                                                                                                                                                                                               |
| /login                           | Glass card with email/password form → HMAC-signed cookie, 30-day expiry                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| /register                        | Glass card with name/email/password/confirm → CREATE users with crypto::argon2 + name, auto sign-in on success                                                                                                                                                                                                                                                                                                                                                                                                                                |
| /logout                          | Clears dali_session cookie, redirects to /login                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| /workspaces                      | Create form + staggered workspace glass cards, "View" cards link to `/workspaces/{slug}/memories`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| /workspaces/[id]/memories        | Workspace-scoped memory list — verifies workspace exists (404 if not). daisyUI card-border glass cards with skeleton loading, 300ms debounced async search with match-type badges (Semantic/Text/Hybrid), daisyUI popover create modal (Name/Content/Type select), delete confirmation dialog with card-out slide animation, tag filter pills (badge-primary/badge-ghost), 3 distinct empty states (no search results/no tag results/no memories), pagination (offset), tooltip + rotate-hover delete buttons. Compat actions: create, delete |
| /workspaces/[id]/memories/[slug] | Workspace-scoped memory detail — verifies workspace exists and memory belongs to workspace (404 on mismatch). Inline edit form, delete button, tag management. Compat actions: edit, delete, add_tag, remove_tag                                                                                                                                                                                                                                                                                                                              |
| /settings                        | Read-only config display + API key management (generate / delete) + profile section (name/email update), user_id linkage via session email                                                                                                                                                                                                                                                                                                                                                                                                    |

### Navbar

Fixed-top glass navbar with "dali-memory" brand link, center nav links (Memories, Workspaces, Settings), user name (or email fallback) when authenticated, Sign In/Register when not, and mobile hamburger dropdown. Active nav link has a bottom underline indicator (`.nav-link.btn-active::after`).

**Workspace-aware nav:**

- "Memories" link targets `/memories` (global memories page showing all memories across all workspaces)
- A workspace context pill is shown on workspace-scoped routes next to the auth section, displaying the current workspace name
- `+layout.server.ts` loads `defaultWorkspaceId` and workspaces list for all authenticated pages

### Keyboard Shortcuts

Available globally via `onkeydown` on `<svelte:window>`. Not intercepted when focus is in editable elements (inputs, textareas, selects, contentEditable).

| Shortcut                | Action                    |
| ----------------------- | ------------------------- |
| `?` or `Cmd/Ctrl` + `/` | Open keyboard help dialog |
| `g` then `h`            | Go to Home                |
| `g` then `m`            | Go to Memories            |
| `g` then `w`            | Go to Workspaces          |
| `g` then `s`            | Go to Settings            |
| `/`                     | Focus search input        |
| `Cmd/Ctrl` + `K`        | Focus search input        |
| `Escape`                | Close dialogs             |

The `g` prefix activates a 1-second window for the navigation key (h/m/w/s). Typing `g` twice within that window cancels the first prefix.

Help dialog is a `<dialog>` element with `<kbd>`-styled shortcut table, triggered via `dialog.showModal()`.

### Dynamic Document Title

Page title updates via `<svelte:head>` based on current route path:

| Route         | Title                    |
| ------------- | ------------------------ |
| `/`           | dali-memory              |
| `/memories`   | Memories - dali-memory   |
| `/login`      | Sign In - dali-memory    |
| `/register`   | Register - dali-memory   |
| `/workspaces` | Workspaces - dali-memory |
| `/settings`   | Settings - dali-memory   |

### Auth Flow

1. `hooks.server.ts` intercepts protected routes (`/memories`, `/workspaces`, `/settings`, `/api`)
2. Public paths (`/login`, `/register`, `/logout`, `/api/mcp`) bypass auth check
3. Reads `dali_session` cookie → HMAC-SHA256 verify → extracts email
4. Constant-time comparison prevents timing attacks
5. On failure: 303 redirect to `/login`
6. `+layout.server.ts` loads user name from DB (via `SELECT name FROM users WHERE email = $email`) and passes it to all pages as `data.name`
7. Navbar displays `data.name ?? data.userEmail` — graceful fallback if DB unavailable
8. Login route validates email+password against `users` table via `crypto::argon2::compare()`
9. Sets signed session cookie (`HMAC(email, secret)`)
10. Registration creates user with `name`, `email`, and `pass` fields, auto-creates a personal workspace (`is_personal: true`) in the same transaction, sets it as the user's `default_workspace_id`, then auto-signs in
11. Settings page provides a **Profile** section (auth-gated) to update name/email — validates format, checks email uniqueness, updates DB, and resigns the session cookie on email change

## Error Handling

Domain-specific typed error classes in `src/lib/server/errors.ts`. All extend `DaliOrmError` from `@woss/dali-orm/core/errors` and carry an optional `context` object for structured error data.

| Error            | Scope                                     | Example Context            |
| ---------------- | ----------------------------------------- | -------------------------- |
| `MemoryError`    | Memory CRUD, search, embedding operations | `{ memoryId: 'mem_123' }`  |
| `TagError`       | Tag create, attach, detach, list          | `{ tagName: 'important' }` |
| `WorkspaceError` | Workspace create, delete, list            | `{ name: 'my-workspace' }` |

### Usage

```ts
import { MemoryError, TagError, WorkspaceError } from '$lib/server/errors';

// All errors are catchable as DaliOrmError
try {
  throw new MemoryError('Memory not found', { memoryId: 'mem_123' });
} catch (err) {
  if (err instanceof MemoryError) {
    console.error(err.context?.memoryId); // 'mem_123'
  }
}
```

### Context Object

Each error accepts an optional `Record<string, unknown>` as its second argument. The context is attached to the error instance and accessible as `.context`. This provides structured, machine-readable error data alongside the human-readable `.message`.

## API Key Auth (MCP)

- Keys generated via `/settings` page (UUID-based, SHA-256 hashed with secret salt)
- Validated on every MCP request (`Authorization: Bearer` header)
- `last_used_at` updated async (fire-and-forget)
- Optional user_id linkage via session cookie email lookup
- Bypassed when `DALI_MEMORY_AUTH_ENABLED` is false

## Tests

Located co-located with their source modules (`.test.ts` suffix or `__tests__/` directory):

| File                                              | Tests                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| src/hooks.server.test.ts                          | Auth handle flow — cookie verification, protected routes, public paths, constant-time comparison, tamper detection |
| src/routes/login/**tests**/page.server.test.ts    | Login form validation, auth logic                                                                                  |
| src/routes/register/**tests**/page.server.test.ts | Registration validation                                                                                            |
| src/routes/settings/**tests**/page.server.test.ts | API key management + profile update (name/email validation, uniqueness, cookie resign)                             |
| src/lib/server/db/**tests**/connection.test.ts    | DB connection lifecycle, connect/disconnect, migration                                                             |

Run: `pnpm test` (vitest), `pnpm test:integration` (no parallelism, all integration tests)

## Scripts

| Script                | Description                        |
| --------------------- | ---------------------------------- |
| pnpm dev              | Vite dev server on port 7777       |
| pnpm build            | Vite production build              |
| pnpm preview          | Vite preview                       |
| pnpm check            | svelte-kit sync + svelte-check     |
| pnpm test             | Unit tests (vitest)                |
| pnpm test:watch       | Watch mode                         |
| pnpm test:integration | Integration tests (no parallelism) |
| pnpm orm              | Proxy to dali-orm CLI              |

## Dependencies

| Package                          | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| @woss/dali-orm                   | Type-safe schema, query builders, migrations |
| surrealdb                        | SurrealDB client driver                      |
| @huggingface/transformers        | Local embedding inference (ONNX)             |
| @modelcontextprotocol/sdk        | MCP protocol server                          |
| @sveltejs/adapter-node           | Production SvelteKit deployment              |
| @sveltejs/kit + svelte v5        | Web framework                                |
| daisyui 5.6.14                   | Component CSS classes                        |
| tailwindcss v4                   | Utility-first CSS                            |
| @tailwindcss/vite                | Tailwind v4 Vite plugin                      |
| zod                              | Configuration schema validation              |
| @logtape/logtape + @logtape/file | Structured logging with file rotation        |
| @logtape/pretty                  | Pretty-printed console output                |

## License

GPL-3.0-only
