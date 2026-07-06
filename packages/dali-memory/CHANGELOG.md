# @woss/dali-memory

## [Unreleased]

### Added

- Content chunking module — hierarchical splitter (heading→paragraph→line→sentence→word) with configurable maxChunkSize, overlap, and minChunkSize
- `chunk_index`, `chunk_text`, and `section` columns on `embeddings` table for per-chunk metadata
- `createMemory` auto-chunks content >1500 chars and embeds each chunk independently, linked to the parent memory via `has_embedding` relation
- `updateMemory` re-chunks and re-embeds content when content changes
- `searchSimilar` deduplicates results by parent memory, keeping only the highest-scoring chunk per memory
- `HybridSearch` workspaceId parameter now uses `RecordId` for proper SurrealDB record-type comparison
- `wsId()` helper on slug page for clean workspace_id comparison between RecordId and route param
- Memory link URLs in workspace memory list use `$page.params.id` instead of `data.workspace?.id` (avoids RecordId leak)

- Global `/memories` route — lists all memories across all workspaces with tag filter pills and workspace name badges linking to workspace-scoped routes
- `MemoryService.listAllMemories(opts?: {limit?, offset?})` — returns all memories without workspace filter, paginated, ordered by created_at DESC
- Workspace-scoped routes `/workspaces/[id]/memories` (list with search, tag filter, pagination) and `/workspaces/[id]/memories/[slug]` (detail with workspace membership verification)
- Old `/memories` and `/memories/[slug]` routes now redirect (307) to workspace-scoped equivalents
- Workspace-aware navbar — "Memories" link targets user's default workspace; context pill shows current workspace name on-scope
- `+layout.server.ts` loads `defaultWorkspaceId` and workspaces list for all authenticated pages
- `workspace_id` field on memory records links to workspaces table
- `user_id` field on workspaces table for ownership (optional)
- `default_workspace_id` field on users table (optional)
- `workspaceId` parameter on `MemoryService.getMemory`, `updateMemory`, `deleteMemory` for workspace membership validation
- `MemoryService.createMemory` validates workspace exists before creating
- Profile settings section on /settings page — name/email update form with validation, email uniqueness check, DB update, and session cookie resign on email change

### Removed

- Dead `embedding` column from `memoriesTable` schema — embeddings are stored in the separate `embeddingsTable` linked via `has_embedding` edge relation
- Removed `embedding?: number[]` from `MemoryRecord` type in service types

### Changed

- Navbar "Memories" link now points to `/memories` (global memories list) instead of workspace-scoped `/workspaces/{defaultWorkspaceId}/memories`
- Redesigned all 6 UI pages with glass morphism cards, gradient mesh background, amber/cyan/purple dark theme
- Added Google Fonts (Space Grotesk headings + DM Sans body)
- Added CSS animations (fadeIn, slideUp, slideDown, scaleIn) with stagger delays
- Added glass navbar with mobile hamburger menu
- Added prefers-reduced-motion support for all animations

## 0.1.0

### Minor Changes

- [#56](https://github.com/woss/surrealdb-orm/pull/56) [`4a786ad`](https://github.com/woss/surrealdb-orm/commit/4a786ad74ae67d76d3dd39c59acd3b50a004ad9a) Thanks [@woss](https://github.com/woss)! - Init project

### Patch Changes

- Updated dependencies [[`4a786ad`](https://github.com/woss/surrealdb-orm/commit/4a786ad74ae67d76d3dd39c59acd3b50a004ad9a)]:
  - @woss/dali-orm@0.1.0
