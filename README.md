# Dali Packages

> SUPER EARLY BETA -- do not use in production yet! API is subject to change without warning.

## Packages

| Package             | Description                                                                       | Readme                                        |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| `@woss/dali-orm`    | Schema definitions, query builders, conditions (merged core + driver)             | [README.md](./packages/dali-orm/README.md)    |
| `@woss/dali-memory` | Agent memory with Dali ORM using embeddings, hooks, and tools backed by SurrealDB | [README.md](./packages/dali-memory/README.md) |

## Development

### Prerequisites

- Node.js >=20 (managed via [mise](https://mise.jdx.dev)) — see [`.mise.toml`](./.mise.toml)
- pnpm 11 — installed via mise or corepack
- [SurrealDB](https://surrealdb.com) (for integration tests)

### Setup

```bash
pnpm install
```

### Build

```bash
pnpm build
```

Builds all packages in parallel (`pnpm -r build`).

### Test

```bash
pnpm test                  # All unit tests
pnpm test:coverage         # With coverage report
pnpm test:watch            # Watch mode
pnpm test:integration      # Integration tests (requires SurrealDB)
```

### Lint & Format

```bash
pnpm lint       # Check
pnpm lint:fix   # Auto-fix
pnpm format     # Format
```

### Clean

```bash
pnpm clean      # Remove all dist/ directories
```

### Local Development Install (Link)

To use these packages in another local project during development:

```bash
# From the dali repo root, build first
pnpm build

# Link each package globally
cd packages/dali-orm && pnpm link --global
cd packages/dali-memory && pnpm link --global

# In your target project
pnpm link --global @woss/dali-orm
pnpm link --global @woss/dali-memory
```

The `dali-orm` CLI can also be used directly from source without linking:

```bash
pnpm --filter @woss/dali-orm exec dali-orm --help
```

### Deploy

Releases are tag-based with keyless OIDC publishing — no npm/JSR tokens involved.

1. Bump `version` in `packages/dali-orm/package.json` **and** `packages/dali-orm/jsr.json` (they must match), update `packages/dali-orm/CHANGELOG.md`, and commit.
2. Tag and push: `git tag v0.4.0 && git push origin v0.4.0`.

The [Release workflow](.github/workflows/release.yml) then runs, in order:

- `gates` — build, test coverage, lint, and tag/package version sync
- `publish-npm` — publishes `@woss/dali-orm` to npm with provenance (npm Trusted Publishing)
- `publish-jsr` — publishes to JSR via OIDC
- `github-release` — attaches a source tarball to the GitHub Release

## License

GPL-3.0-only
