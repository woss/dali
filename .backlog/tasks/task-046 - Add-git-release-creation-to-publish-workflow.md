---
id: TASK-046
title: Add git release creation to publish workflow
status: Done
assignee: []
created_date: '2026-06-05 22:46'
updated_date: '2026-06-05 22:50'
labels: []
dependencies: []
modified_files:
  - .github/workflows/publish.yml
  - .changeset/config.json
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Make explicit that changesets/action creates GitHub Releases for both @woss/dali-orm and @woss/dali-memory after npm publish. Two changes:

1. Add `createGithubReleases: true` to changesets/action config in publish.yml
2. Fix `baseBranch` from `origin/main` to `main` in .changeset/config.json

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 publish.yml has `createGithubReleases: true` on changesets/action step
- [x] #2 .changeset/config.json `baseBranch` is `"main"` not `"origin/main"`
- [x] #3 Changes committed to a branch

<!-- AC:END -->
