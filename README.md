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

Bump version on a branch, merge to main — CI auto-detects and publishes.

```bash
# On your feature branch, bump version (patch/minor/major)
pnpm bump patch   # 0.1.0 → 0.1.1
pnpm bump minor   # 0.1.0 → 0.2.0
pnpm bump major   # 0.1.0 → 1.0.0

# This creates a commit via `but` with the version bump.
# Push the branch and merge to main — CI handles the rest.
```

On every push to `main`, the [Publish workflow](.github/workflows/publish.yml) reads the version from `packages/dali-orm/package.json`. If the `v*` tag for that version doesn't exist yet, it:

- Builds both packages
- Publishes `@woss/dali-orm` and `@woss/dali-memory` to npm
- Creates a GitHub Release (with tag) with auto-generated notes

No manual tag management needed.

## License

GPL-3.0-only
