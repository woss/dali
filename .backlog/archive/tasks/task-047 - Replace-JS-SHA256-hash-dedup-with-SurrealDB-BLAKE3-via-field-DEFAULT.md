---
id: TASK-047
title: Replace JS SHA256 hash dedup with SurrealDB BLAKE3 via field DEFAULT
status: Done
assignee: []
created_date: '2026-05-15 20:25'
updated_date: '2026-05-16 21:50'
labels:
  - dali-memory
  - performance
  - migration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Replace client-side SHA256 hashing with SurrealDB's built-in crypto::blake3() function as a field DEFAULT on content_hash column. Remove contentHash computation from memory-service.ts, remove hash pre-check from surreal-client.ts, change dedup strategy to catch unique constraint violations, and create migration to add DEFAULT to content_hash field.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 schema.ts: content_hash uses defaultRaw('crypto::blake3(content)')
- [x] #2 memory-service.ts: remove sha256(), contentHash from record and saveMemory call
- [x] #3 surreal-client.ts: remove contentHash from params, change dedup to INSERT-first + catch unique violation
- [x] #4 Migration created to add DEFAULT crypto::blake3(content) to content_hash field
- [x] #5 All existing tests still pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Delegated to build agent. Implementation includes:

1. schema.ts: add defaultRaw to content_hash
2. memory-service.ts: remove sha256(), contentHash
3. surreal-client.ts: remove contentHash param, change dedup to INSERT-first with unique violation catch
4. Migration: content-hash-blake3 with DEFAULT crypto::blake3(content)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

TASK-047 already implemented. content_hash field uses defaultRaw('crypto::blake3(content)') in schema.ts. JS-side contentHash/sha256 removed from memory-service.ts. surreal-client.ts uses INSERT-first dedup strategy with unique constraint violation catch. Migration 20260515183000_content_hash_blake3 exists with DEFINE FIELD OVERWRITE content_hash ... DEFAULT crypto::blake3(content). All tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
