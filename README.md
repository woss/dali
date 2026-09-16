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

Versioning and publishing use [Changesets](https://github.com/changesets/changesets). Each PR that should trigger a release includes a changeset file describing the version bump and changelog entry.

```bash
# Create a changeset for your PR (select packages + bump type)
pnpm changeset

# Preview what the version bump will look like
pnpm version-packages

# Publish (CI does this automatically on merge to main)
pnpm release
```

On every push to `main`, the [Publish workflow](.github/workflows/publish.yml) runs `changesets/action`:

- Creates or updates a "Version Packages" PR with aggregated version bumps and changelog entries
- When that PR merges, publishes `@woss/dali-orm` and `@woss/dali-memory` to npm
- Creates GitHub Releases with auto-generated changelog notes

No manual tag management needed. To include a change in the next release, run `pnpm changeset` on your branch and commit the generated file.

## License

GPL-3.0-only
