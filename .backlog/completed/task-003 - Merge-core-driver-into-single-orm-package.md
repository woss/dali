---
id: TASK-003
title: Merge core + driver into single orm package
status: Done
assignee: []
created_date: '2026-04-24 11:48'
updated_date: '2026-04-24 14:11'
labels:
  - restructure
  - breaking-change
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Merge core + driver into single @surrealdb-orm/orm package, remove old packages.

## Changes

- Created packages/orm with merged schema/ and driver/ structure
- Updated kit package.json dependencies to @surrealdb-orm/orm
- Updated all kit source imports to @surrealdb-orm/orm
- Updated all examples imports to @surrealdb-orm/orm
- Deleted packages/core and packages/driver directories
- Fixed vitest workspace config to use orm package
- Fixed test imports to use .ts source paths
- 513 tests passing

## New Structure

- packages/orm (new merged package)
- packages/kit (updated dependencies)
- examples (updated imports)
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Merged core + driver into single @surrealdb-orm/orm package, removed old packages.

## Changes

- Created packages/orm with merged schema/ and driver/ structure
- Updated kit package.json dependencies to @surrealdb-orm/orm
- Updated all kit source imports to @surrealdb-orm/orm
- Updated all examples imports to @surrealdb-orm/orm
- Deleted packages/core and packages/driver directories
- Fixed vitest workspace config to use orm package
- Fixed test imports to use .ts source paths
- 513 tests passing

## New Structure

- packages/orm (new merged package)
- packages/kit (updated dependencies)
- examples (updated imports)
<!-- SECTION:FINAL_SUMMARY:END -->
