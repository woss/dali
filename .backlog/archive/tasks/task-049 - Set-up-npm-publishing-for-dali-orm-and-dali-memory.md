---
id: TASK-049
title: Set up npm publishing for dali-orm and dali-memory
status: Done
assignee: []
created_date: '2026-05-16 22:01'
updated_date: '2026-06-03 20:12'
labels:
  - publishing
  - ci
  - npm
  - changesets
dependencies: []
references:
  - /Users/woss/projects/woss/surrealdb-orm/packages/dali-orm/package.json
  - /Users/woss/projects/woss/surrealdb-orm/packages/dali-memory/package.json
  - /Users/woss/projects/woss/surrealdb-orm/.github/workflows/ci.yml
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Configure automated npm publishing for the dali-orm monorepo (pnpm workspaces, TypeScript, ESM-only). Two publishable packages: `dali-orm` (core ORM, 40+ subpath exports) and `dali-memory` (memory plugin, depends on dali-orm).

Research done — findings summary:

RECOMMENDED TOOL: Changesets (best monorepo support, handles workspace:\* replacement, PR-based versioning, transitive dependency bumps). Better than semantic-release (no monorepo support) or release-please (archived).

PRE-PUBLISH GAPS TO FIX:

| Gap                      | dali-orm                                            | dali-memory            |
| ------------------------ | --------------------------------------------------- | ---------------------- |
| files: ["dist"]          | Missing                                             | Missing                |
| publishConfig.access     | Missing                                             | Missing                |
| publishConfig.provenance | Missing                                             | Missing                |
| repository field         | Missing                                             | Missing                |
| engines                  | ✅ >=18.0.0                                         | Missing                |
| workspace:\* dep         | N/A                                                 | dali-orm: workspace:\* |
| Build command            | `vp pack` (but tsdown.config.ts exists — confusion) | `tsdown` (clean)       |

Both packages also missing README updates (references removed SurrealORM class), LICENSE file in repo root missing.

CI WORKFLOW PLAN:

- GitHub Actions with id-token:write (for npm provenance via OIDC)
- Trigger: push to main with v\* tag (Changesets auto-version PR)
- Steps: checkout → mise → pnpm install → build → pnpm publish
- Can use npm Trusted Publishing (no NPM_TOKEN needed)

OPEN QUESTIONS (need user decisions):

1. Versioning: Independent (per-package) or fixed (all share same version)?
2. npm scope: publish as `@woss/dali-orm` or just `dali-orm`?
3. npm provenance: Trusted Publishing (no tokens) or standard NPM_TOKEN?
4. JSR: worth dual-publishing or npm-only?
5. Changesets: changeset files per PR or conventional-commits auto-detection?
6. Private packages: should dali-memory be private (not published)?

CURRENT STRUCTURE:

- Root package.json: private: true, engines: >=20.0.0, pnpm@11.1.2
- packages/dali-orm/: build via `vp pack`, tsdown.config.ts exists, 130 lines package.json with 40+ exports
- packages/dali-memory/: build via `tsdown`, 59 lines package.json with 12 export paths
- packages/orm/ and packages/kit/: dead dirs (no package.json, not publishable)
- .npmrc: auto-install-peers=true, catalog=default
- No .gitignore for coverage/coverage-summary.json — test:coverage script exists but output path in CI

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 Changesets installed + configured: `pnpm add -Dw @changesets/cli`, `npx changeset init`, config for independent versioning
- [ ] #2 #2 All pre-publish gaps fixed in both package.json files (files, publishConfig, repository, engines)
- [ ] #3 #3 workspace:\* dependency in dali-memory replaced automatically by pnpm publish (verify with pnpm pack)
- [ ] #4 #4 GitHub Actions publish workflow created (or integrated into CI) with id-token:write and --provenance
- [ ] #5 #5 Test run: pnpm test passes after all changes
- [ ] #6 #6 Build run: pnpm build produces dist/ for both packages
- [ ] #7 #7 README updated for both packages if outdated API references exist
- [ ] #8 #8 LICENSE file added to repo root
- [ ] #9 #9 User decisions on open questions documented/implemented before CI workflow finalized

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## License Decision

- **License**: GPL (copyleft — force contributions)
  - Both packages: `"license": "GPL-3.0-only"` or `"GPL-3.0-or-later"`?
  - LICENSE file in repo root needed
  - Same license for both packages

Needs confirmation: `GPL-3.0-only` or `GPL-3.0-or-later`?

<!-- SECTION:NOTES:END -->
