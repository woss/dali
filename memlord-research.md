# Memlord — Complete Architecture & Technology Analysis

## Overview

Memlord is an **MCP (Model Context Protocol) memory server** with hybrid BM25 + vector search, backed by PostgreSQL + pgvector. It provides persistent memory storage for AI agents, supporting 5 memory types: fact, preference, instruction, feedback, and decision.

---

## 1. Memory Type Distinction

**File:** `src/memlord/schemas/memory_type.py`

```python
class MemoryType(StrEnum):
    fact = "fact"             # established fact about user, project, or system
    preference = "preference" # user's likes, dislikes, habits
    instruction = "instruction"  # persistent rule Claude must follow
    feedback = "feedback"     # evaluation of Claude's output
    decision = "decision"     # a choice made with reasoning
```

### How It Works

- **The caller (AI agent or human) decides the type** at store time via the `memory_type` parameter.
- **Zero server-side enforcement.** No validation, no auto-classification, no behavioral logic depends on the type value.
- Stored as a plain `VARCHAR(50)` string in the `memories` table.
- The only technical use of the type column is **filtering** — passed as `WHERE memory_type = $type` when the caller provides the `memory_type` parameter to `retrieve_memory`, `recall_memory`, or `list_memories`.

---

## 2. Request Path & Server Architecture

```
MCP Client / HTTP API / Web UI
        │
        ▼
  FastAPI app (main.py)
    ├── /api/*     → REST API routers (memories, search, workspaces, api_keys)
    ├── /ui/*      → Web UI pages (Jinja2 templates: index, search, login, etc.)
    └── /mcp       → FastMCP transport (SSE)
         │
         ▼
  FastMCP server (server.py)
    ├── auth=MemlordOAuthProvider (OAuth 2.1 / API keys)
    └── mounted sub-servers via mcp.mount():
         store / retrieve / recall / get_memory /
         list_memories / search_by_tag / delete / update / move / workspaces
              │
              ▼
         DAO layer (dao/: memory.py, workspace.py, user.py, api_key.py, email_token.py)
              │
              ▼
         asyncpg (SQLAlchemy Core queries)
              │
              ▼
         PostgreSQL + pgvector
```

**Server assembly** (`src/memlord/server.py`):

```python
mcp: FastMCP = FastMCP("Memlord", auth=MemlordOAuthProvider(...))
mcp.mount(store)       # store_memory
mcp.mount(retrieve)    # retrieve_memory
mcp.mount(recall)      # recall_memory
mcp.mount(get_memory)  # get_memory
mcp.mount(list_memories)
mcp.mount(search_by_tag)
mcp.mount(delete)      # delete_memory
mcp.mount(update)      # update_memory
mcp.mount(move)        # move_memory
mcp.mount(workspaces)  # list_workspaces
```

Each tool file in `src/memlord/tools/` creates its own `FastMCP()` instance and registers tools with `@mcp.tool()`. These are mounted into the root server.

---

## 3. Storage Path (Write)

**Entrypoint:** `tools/store.py::store_memory()`

Full call chain from client to database:

### 3.1 Workspace Resolution

```python
ws_dao = WorkspaceDao(s, uid)
if workspace is not None:
    ws = await ws_dao.get_by_name(workspace)  # resolve workspace name
    if not await ws_dao.can_write(ws.id):      # check write permission
        raise ValueError(...)
else:
    ws = await ws_dao.get_personal()            # default to personal workspace
```

### 3.2 Exact Dedup Check

```python
memory_id = await self._s.scalar(
    select(Memory.id).where(
        Memory.content == content,
        Memory.workspace_id == workspace_id,
    )
)
if memory_id is not None:
    return memory_id, False  # return existing, created=False
```

The `(content, workspace_id)` unique constraint prevents exact duplicates at the DB level too.

### 3.3 Embedding Generation

```python
def _embed_text(content: str, tags: set[str]) -> str:
    return f"{content} {' '.join(sorted(tags))}" if tags else content

vector = await embed(_embed_text(content, tags or set()))
```

The embedder input is `content + " " + sorted_tags` (alphabetically sorted, space-joined).

### 3.4 Near-Duplicate Detection

```python
# Cosine distance via pgvector <=> operator
distance_expr = Memory.embedding.op("<=>", return_type=Float)(vec_param)
# Fetch closest neighbor in the workspace
dup_row = select(Memory.id, distance_expr).where(
    Memory.embedding.isnot(None),
    Memory.workspace_id == workspace_id,
).order_by(distance_expr).limit(1)

if similarity >= 0.85:  # 1.0 - distance
    raise ValueError("Near-duplicate found. Pass force=True to store anyway.")
```

`MEMLORD_DEDUP_THRESHOLD` (default 0.85) controls sensitivity.

### 3.5 INSERT

```python
memory_id = await self._s.scalar(
    insert(Memory).values(
        content=str(content),
        memory_type=MemoryType(memory_type),
        extra_data=metadata or {},
        embedding=vector,
        created_by=self._uid,
        workspace_id=workspace_id,
        name=name,
    ).returning(Memory.id)
)
```

### 3.6 Tag Upsert

```python
for tag_name in tags:
    normalized = tag_name.lower().strip()
    await self._s.execute(
        pg_insert(Tag).values(name=normalized).on_conflict_do_nothing()
    )
    tag_id = await self._s.scalar(select(Tag.id).where(Tag.name == normalized))
    await self._s.execute(
        pg_insert(MemoryTag).values(memory_id=memory_id, tag_id=tag_id)
            .on_conflict_do_nothing()
    )
```

Tags are global (shared across workspaces). `memory_tags` is a standard M:N join table.

---

## 4. Embedding Pipeline

**File:** `src/memlord/embeddings.py`

### 4.1 Model Loading (Cached)

```python
@cache
def _get_session() -> InferenceSession:
    return InferenceSession(str(settings.model_dir / "model.onnx"))

@cache
def _get_tokenizer() -> Tokenizer:
    t = Tokenizer.from_file(str(settings.model_dir / "tokenizer.json"))
    t.enable_padding(pad_token="[PAD]")
    t.enable_truncation(max_length=512)
    return t
```

Both are loaded once per process via `functools.cache`. Model files are at `src/memlord/onnx/` (downloaded from HuggingFace `sentence-transformers/all-MiniLM-L6-v2` via `scripts/download_model.py`).

### 4.2 Tokenization

```python
encoding = tokenizer.encode(text)
input_ids = np.array([encoding.ids], dtype=np.int64)           # [1, seq_len]
attention_mask = np.array([encoding.attention_mask], dtype=np.int64)  # [1, seq_len]
token_type_ids = np.zeros_like(input_ids, dtype=np.int64)       # [1, seq_len]
```

- **Tokenizer:** HuggingFace WordPiece with 30,522 vocabulary (same as BERT)
- **Padding:** Enabled with `[PAD]` token — all inputs padded to 512 tokens
- **Truncation:** Enabled at 512 tokens (model's max context window)
- **Input shape:** 3 tensors: `input_ids`, `attention_mask`, `token_type_ids`, each `[1, 512]`

### 4.3 Async ONNX Inference

```python
loop = asyncio.get_running_loop()
future: asyncio.Future[list[np.ndarray]] = loop.create_future()

def _callback(results: list[np.ndarray], _user_data: None, err: str) -> None:
    if err:
        loop.call_soon_threadsafe(future.set_exception, RuntimeError(err))
    else:
        loop.call_soon_threadsafe(future.set_result, results)

session.run_async(None, { "input_ids": ..., "attention_mask": ..., "token_type_ids": ... },
                  _callback, None)

outputs = await future  # blocks until ONNX finishes
```

Uses ONNX Runtime's `run_async()` with a callback pattern to bridge from the ONNX thread pool back into the asyncio event loop. The callback safely wakes the awaiting coroutine via `loop.call_soon_threadsafe()`.

### 4.4 Post-Processing

**Step 1 — Mean Pooling with Attention Mask:**

```python
token_embeddings = np.asarray(outputs[0])  # shape (1, 512, 384)
mask = attention_mask[..., np.newaxis].astype(np.float32)  # (1, 512, 1)
pooled = (token_embeddings * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1e-9)
```

- Raw ONNX output: one 384-dim vector **per token** (all 512 positions)
- Attention mask (1=real token, 0=[PAD]) zeros out padding positions
- Sum of real token vectors divided by count of real tokens → average
- `clip(min=1e-9)` prevents division by zero on empty input

**Step 2 — L2 Normalization:**

```python
norm = np.linalg.norm(pooled, axis=1, keepdims=True).clip(min=1e-9)
normalized = (pooled / norm).astype(np.float32)
```

- Divides by Euclidean norm → unit vector (length = 1)
- Required for cosine distance (`<=>`) to work correctly
- Cosine similarity for unit vectors = dot product

### 4.5 Output

```python
return normalized[0].tolist()  # list[float] of 384 floats
```

Returned as a plain Python list. Passed directly to pgvector's `Vector(384)` type — the bind_processor converts to `'[v1,v2,...]'` string, asyncpg sends as text, PostgreSQL casts server-side.

---

## 5. Search Pipeline

**File:** `src/memlord/search.py`

### 5.1 Parameters

```python
async def hybrid_search(
    session, query, workspace_ids, limit, similarity_threshold,
    date_from, date_to, memory_type
) -> list[SearchResult]:
```

Config-driven defaults: `n = limit * 4` (fetch 4x more per branch), `k = 60` (RRF), `threshold = 0.25`.

### 5.2 Common Filters

```python
conditions = [access]        # WHERE workspace_id IN (...)
if date_from: conditions.append(Memory.created_at >= date_from)
if date_to:   conditions.append(Memory.created_at <= date_to)
if memory_type: conditions.append(Memory.memory_type == memory_type)
```

### 5.3 BM25 Branch (PostgreSQL Full-Text Search)

```python
tsquery = func.websearch_to_tsquery("simple", query)
ts_rank_expr = func.ts_rank(Memory.search_vector, tsquery)
bm25_rank = func.row_number().over(order_by=ts_rank_expr.desc()).label("bm25_rank")

# Tag match subquery
tag_match = select(MemoryTag.memory_id).join(...).where(
    func.to_tsvector("simple", Tag.name).op("@@")(tsquery)
).exists()

bm25_q = select(Memory.*, Workspace.name, bm25_rank).where(
    (Memory.search_vector.op("@@")(tsquery)) | tag_match,
    *conditions
).order_by(ts_rank_expr.desc()).limit(n)
```

- **`search_vector`** is a `TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED` column — auto-maintained by PostgreSQL
- Uses `websearch_to_tsquery` which supports quoted phrases, `AND`, `OR`, `-` (negation) syntax
- `ts_rank` ranks by TF-IDF-like relevance
- GIN-indexed for fast `@@` matches
- Also searches tag names by converting `Tag.name` to `tsvector` on-the-fly (small table, acceptable)

### 5.4 Vector KNN Branch (pgvector)

```python
vector = await embed(query)  # same ONNX pipeline
distance = Memory.embedding.op("<=>", return_type=Float)(vec_param).label("distance")
vec_rank = func.row_number().over(order_by=distance).label("vec_rank")

vec_q = select(Memory.*, Workspace.name, distance, vec_rank).where(
    Memory.embedding.isnot(None), *conditions
).order_by(distance).limit(n)
```

- Cosine distance: `<=>` returns `1 - cos(θ)`
- HNSW index (`m=16, ef_construction=64, vector_cosine_ops`) for approximate nearest neighbor
- Null check: `embedding IS NOT NULL` (column is nullable)

### 5.5 Reciprocal Rank Fusion (RRF)

```python
all_ids = set(bm25_ranks) | set(vec_ranks)
for doc_id in all_ids:
    rrf = 0.0
    if doc_id in bm25_ranks:
        rrf += 1.0 / (k + bm25_ranks[doc_id])
    if doc_id in vec_ranks:
        rrf += 1.0 / (k + vec_ranks[doc_id])
    scored.append(SearchResult(id=doc_id, ..., rrf_score=rrf, ...))
```

### 5.6 Threshold Filtering

```python
# Pure-vector hits (no BM25 match) with similarity < threshold are dropped
if doc_id not in bm25_ranks and similarity is not None and similarity < threshold:
    continue
```

This prevents noise: if a document was only found by vector similarity and the score is low, it's excluded. BM25-matched documents are always included regardless of vector similarity.

### 5.7 Final Sort & Truncation

```python
scored.sort(key=lambda r: r.rrf_score, reverse=True)
return scored[:limit]
```

---

## 6. recall_memory — Time-Expression Search

**File:** `src/memlord/tools/recall.py`

```python
found = search_dates(query, settings={"PREFER_DATES_FROM": "past", "RETURN_AS_TIMEZONE_AWARE": False})
if found:
    dts = [dt for _, dt in found]
    date_from = min(dts).replace(hour=0, minute=0, second=0, microsecond=0)
    date_to = datetime.now(timezone.utc).replace(tzinfo=None)
    # Strip date expressions from query for semantic search
    for date_str, _ in found:
        remaining = remaining.replace(date_str, "")
    semantic_query = remaining.strip() or query
```

- Uses `dateparser.search_dates()` to find temporal expressions ("last week", "yesterday", "in March")
- Extracted date ranges passed to `hybrid_search()` as `date_from`/`date_to` filters
- `similarity_threshold=0.0` — no threshold filtering for time-based results
- Remaining text used as semantic query; if all text was date expressions, falls back to original query

---

## 7. Database Schema

### 7.1 `memories` Table (Core)

```sql
CREATE TABLE memories (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type     VARCHAR(50) NOT NULL,          -- 'fact'|'preference'|'instruction'|'feedback'|'decision'
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    workspace_id    INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    embedding       vector(384),                    -- nullable; set by app on INSERT/UPDATE
    search_vector   TSVECTOR NOT NULL
                    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,

    UNIQUE (content, workspace_id),
    UNIQUE (name, workspace_id)
);

CREATE INDEX ix_memories_search_vector ON memories USING GIN (search_vector);
CREATE INDEX ix_memories_embedding ON memories USING HNSW (embedding vector_cosine_ops)
    WITH (m=16, ef_construction=64);
```

### 7.2 `tags` Table

```sql
CREATE TABLE tags (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL           -- lowercase, trimmed
);
```

### 7.3 `memory_tags` Table (M:N Join)

```sql
CREATE TABLE memory_tags (
    memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    tag_id    INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, tag_id)
);
```

### 7.4 Supporting Tables

| Table               | Key Columns                                                                   | Purpose                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `users`             | id, email (unique), display_name, hashed_password, email_verified, created_at | User accounts                        |
| `workspaces`        | id, name (unique), created_by, created_at, is_personal, description           | Collaboration containers             |
| `workspace_members` | workspace_id, user_id, role (owner/editor/viewer), joined_at                  | M:N membership with roles            |
| `workspace_invites` | id (UUID PK), workspace_id, created_by, expires_at, role, used_by, used_at    | Invite tokens                        |
| `api_keys`          | id, user_id, name, token_hash (unique), prefix, created_at, last_used_at      | API key auth                         |
| `oauth_clients`     | client_id (PK), data (JSONB), user_id, created_at                             | Dynamic OAuth client registration    |
| `revoked_tokens`    | jti (PK), expires_at                                                          | Token revocation (survives restarts) |
| `email_tokens`      | token_hash (PK), user_id, purpose (verify/reset), expires_at                  | Email verification/password reset    |
| `schema_version`    | version (PK), applied_at                                                      | Manual migration tracker             |

---

## 8. Other MCP Tools

### 8.1 `get_memory(name, workspace)`

Fetches full content of a single memory by name. Returns `MemoryDetail` with name, content, memory_type, metadata, tags, created_at, workspace.

### 8.2 `list_memories(page, page_size, memory_type, tag)`

Paginated browse, newest-first. Optional `memory_type` or `tag` filter. Returns `MemoryPage` with items, total, page, page_size.

### 8.3 `search_by_tag(tags, operation="AND"|"OR")`

Tag-only search. AND mode uses a subquery counting distinct matching tags per memory. OR mode uses JOIN DISTINCT.

### 8.4 `update_memory(name, memory_type, content, new_name, tags, metadata, workspace)`

Updates specified fields. Re-embeds if content or tags changed. Cleans up orphan tags.

### 8.5 `delete_memory(name, workspace)`

Deletes by name. Cascades to `memory_tags`. Cleans up orphan tags.

### 8.6 `move_memory(name, to_workspace, from_workspace)`

Transfers between workspaces. Checks content/name uniqueness at target.

---

## 9. Auth System

### OAuth 2.1

- Custom `MemlordOAuthProvider` in `oauth.py` (extends FastMCP's `OAuthProvider`)
- JWT-based access tokens
- Login page served in-process at `/ui/login`
- Enabled when `MEMLORD_OAUTH_JWT_SECRET`, `MEMLORD_OAUTH_PASSWORD`, `MEMLORD_BASE_URL` are set

### API Keys

- Format: `mk_` prefix + 32 bytes of `secrets.token_urlsafe()` → ~43 char token
- Example: `mk_q5K8x...`
- Only SHA-256 hash stored in DB
- Resolved via synthetic OAuth client_id: `"apikey:{user_id}"`

### Password Auth

- bcrypt hashing (`hash_password` / `verify_password`)

### MCP User Resolution (`auth.py`)

```python
async def _current_user_gen(s):
    access_token = get_access_token()
    if access_token.client_id.startswith("apikey:"):
        yield int(access_token.client_id.removeprefix("apikey:"))
    else:
        user_id = await s.scalar(
            select(OAuthClient.user_id).where(OAuthClient.client_id == access_token.client_id)
        )
        yield user_id
MCPUserDep = MCPDepends(asynccontextmanager(_current_user_gen))
```

---

## 10. DB Session Management

**File:** `src/memlord/db.py`

```python
@cache
def get_engine() -> AsyncEngine:
    return create_async_engine(settings.db_url, echo=settings.db_echo, pool_pre_ping=True)

@cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=True)

async def session_dep():
    session_factory = get_session_factory()
    async with session_factory() as s, s.begin():  # auto-begin transaction
        yield s  # auto-commit on success, auto-rollback on exception
```

- **Never call `commit()` or `rollback()` manually** — the context manager handles it
- `expire_on_commit=True`: objects expire after commit, preventing stale reads
- `pool_pre_ping=True`: test connections before use
- Two dependency flavors: `MCPSessionDep` (FastMCP) and `APISessionDep` (FastAPI)

---

## 11. Technology Stack Summary

| Layer           | Technology                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Language        | **Python 3.12**                                                                                                           |
| Web framework   | **FastAPI** + **uvicorn**                                                                                                 |
| MCP framework   | **FastMCP 3.1+** (`mcp.mount()` sub-server pattern)                                                                       |
| DB driver       | **asyncpg** (pure async, no sync driver)                                                                                  |
| ORM             | **SQLAlchemy 2.0 Core** — no `relationship()`, no lazy loading, no `Mapped`                                               |
| Database        | **PostgreSQL** + **pgvector** extension                                                                                   |
| Vector index    | **HNSW** (`m=16, ef_construction=64, vector_cosine_ops`)                                                                  |
| Full-text index | **GIN** (on `TSVECTOR` column)                                                                                            |
| Embedding model | `sentence-transformers/**all-MiniLM-L6-v2**` (384-dim output)                                                             |
| ONNX runtime    | **ONNX Runtime** (`InferenceSession.run_async()` with callback+Future)                                                    |
| Tokenizer       | **HuggingFace tokenizers** — WordPiece (30,522 vocab), padding=`[PAD]`, truncation=512                                    |
| Search fusion   | **Reciprocal Rank Fusion** (k=60, configurable via `MEMLORD_RRF_K`)                                                       |
| Auth            | **OAuth 2.1** (custom provider), **API keys** (`mk_` prefix, SHA-256 hashed), **bcrypt** passwords, **JWT** (joserfc lib) |
| Config          | **pydantic-settings** (`MEMLORD_*` env prefix), `.env` file support                                                       |
| Migrations      | **Alembic** (async via `asyncio.run()`, asyncpg only)                                                                     |
| Time parsing    | **dateparser** (`search_dates()`)                                                                                         |
| Validation      | **Pydantic v2** (`BaseModel`, `StrEnum`, computed fields)                                                                 |
| Email           | **aiosmtplib** (for password reset, email verification)                                                                   |

---

## 12. Config Reference

**File:** `src/memlord/config.py`

| Variable                   | Default                                                    | Description                                |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `MEMLORD_DB_URL`           | `postgresql+asyncpg://postgres:postgres@localhost/memlord` | Database connection                        |
| `MEMLORD_DB_ECHO`          | `False`                                                    | Log all SQL                                |
| `MEMLORD_MODEL_DIR`        | `src/memlord/onnx`                                         | Path to ONNX model files                   |
| `MEMLORD_HOST`             | `0.0.0.0`                                                  | Bind address                               |
| `MEMLORD_PORT`             | `8000`                                                     | Port                                       |
| `MEMLORD_BASE_URL`         | `http://localhost:8000`                                    | Public URL (for OAuth redirects)           |
| `MEMLORD_RRF_K`            | `60`                                                       | RRF constant                               |
| `MEMLORD_DEFAULT_LIMIT`    | `10`                                                       | Default search result count                |
| `MEMLORD_SIM_THRESHOLD`    | `0.25`                                                     | Min similarity for pure-vector results     |
| `MEMLORD_DEDUP_THRESHOLD`  | `0.85`                                                     | Near-duplicate cosine similarity threshold |
| `MEMLORD_OAUTH_JWT_SECRET` | `memlord-dev-secret-please-change`                         | JWT signing key                            |
| `MEMLORD_LOG_LEVEL`        | `INFO`                                                     | Logging level                              |

---

## 13. Key Architectural Decisions

1. **`search_vector` is PostgreSQL-generated** — `GENERATED ALWAYS AS (to_tsvector(...)) STORED`. The app never writes it. Content changes are auto-indexed.

2. **`embedding` is app-managed** — set on INSERT and on content/tag changes in UPDATE. Nullable for future migration scenarios.

3. **Vector parameter passing** — `list[float]` passed directly; `Vector(384).bind_processor` converts to string. Never use `register_vector` (codec conflict with bind_processor). Never manually format vec strings.

4. **No ORM `relationship()`** — all joins are explicit in Core `select()` calls with `.join()` or subqueries. No lazy loading.

5. **Dual API surface** — MCP tools (FastMCP) + REST API (FastAPI routers at `/api/*`) + Web UI (Jinja2 at `/ui/*`). FastMCP `http_app` is mounted at root (`/`); MCP transport at `/mcp`.

6. **Near-dedup uses cosine similarity** — `1.0 - (embedding <=> query_vec) >= 0.85` blocks near-duplicate content. Configurable.

7. **Memory type is purely a metadata tag** — stored as raw string, validated at Pydantic boundary, used only for filtering. No behavioral logic depends on it.

8. **Session auto-commit** — async context manager commits on success, rolls back on exception. Never call `commit()` or `rollback()` manually.

9. **No `__init__.py` logic** — re-exports only. All logic lives in dedicated modules.

10. **No `from __future__ import annotations`** — model-style uses classical `sa.Column()` with no `Mapped` annotations.
