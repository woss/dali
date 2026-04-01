# Contributing to DaliORM

## Getting Started

```bash
git clone <repo-url>
cd dali-orm
pnpm install     # installs all workspace dependencies
pnpm build       # builds all 4 packages
pnpm test        # runs 1917 tests across 36 files
```

Prerequisites: `pnpm@10.33.0`, Node.js >=20.

## Development Workflow

1. **Branch** — Branch from `main` unless you have explicit guidance otherwise. Use GitButler:

   ```bash
   but branch new <branch-name> -c <task-id>
   ```

   Branch naming: reference the task ID from Backlog.md (e.g., `feat/shadow-db`, `fix/content-hash-dedup`).

2. **Code** — make changes following project conventions:
   - TypeScript strict mode, ES2022 target, ESNext modules
   - Valibot schemas for all public API validation
   - Immutable, chainable query builders
   - Early exit, parse-don't-validate, fail-fast patterns

3. **Test** — run relevant tests:

   ```bash
   pnpm test                    # all tests
   pnpm test -- --filter=<package>  # specific package
   vp test run                  # same as pnpm test
   vp test run --coverage       # with coverage
   vp test watch                # watch mode
   ```

4. **Format & Lint** — Vite+ handles both:

   ```bash
   pnpm format     # vp fmt
   pnpm lint       # vp check
   ```

5. **Build** — verify the package builds:

   ```bash
   pnpm build      # runs vp pack in all packages
   ```

6. **Commit** — use GitButler with descriptive message:
   ```bash
   but commit -m "feat(package): short description"
   ```
   Pre-commit hooks auto-run `vp check --fix` on staged files.

## Build System

**Vite+** (`vite-plus`) is the build and dev toolchain — replaces tsup/tsdown.

| Command       | What it does                                  |
| ------------- | --------------------------------------------- |
| `vp pack`     | Build package to `dist/`                      |
| `vp test run` | Run tests (Vitest-compatible)                 |
| `vp check`    | Lint + format + type-check in one pass        |
| `vp fmt`      | Format code via Oxfmt                         |
| `vp config`   | Setup project config (runs on `pnpm install`) |
| `vp staged`   | Pre-commit hook — check + fix staged files    |

Configured in root `vite.config.ts`:

```ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: { '*': 'vp check --fix' },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
```

Each package's `package.json` has `"build": "vp pack"` — no per-package build config needed. Vite+ handles bundling, code splitting, and type generation automatically.

## Testing

- **Runner**: Vite+ test (`vp test run`), Vitest-compatible
- **Coverage**: `vp test run --coverage` (via `@vitest/coverage-v8`)
- **Watch mode**: `vp test watch`
- **Suite size**: 1917 tests across 36 files
- **Pattern**: Tests live in `tests/` directories within each package
- **Mocking**: Mock SurrealDB client when testing query builders in isolation

CI runs `pnpm test:cov` and reports coverage via `davelosert/vitest-coverage-report-action`.

### Integration Tests

Integration tests in `dali-memory` connect to a running SurrealDB instance via HTTP. They require:

1. A SurrealDB server running at `SURREALDB_URL` (default `http://localhost:10101`)
2. Credentials in `SURREALDB_USER` / `SURREALDB_PASSWORD` (default `admin` / `admin`)
3. Environment loaded from `.env` in the project root

Run integration tests:

```bash
# dali-memory only (2 files, 33 tests)
pnpm --filter dali-memory test:integration

# or from root
pnpm test:integration
```

**Important**: Integration test files must run with `--no-file-parallelism` because they connect to the same SurrealDB server and interfere when creating/removing databases concurrently. The `test:integration` script includes this flag.

All tests (unit + integration):

```bash
# from dali-memory directory
pnpm test:all

# or from root
pnpm --filter dali-memory test:all
```

## Linting & Formatting

- **Tool**: Vite+ (Oxlint + Oxfmt, configured via `vite.config.ts`)
- **Check**: `vp check` — lint + format + type-check in one pass
- **Format**: `vp fmt` — format code via Oxfmt
- **Pre-commit**: `.vite-hooks/pre-commit` runs `vp staged` which calls `vp check --fix` on staged files only
- **CI**: `npx vp check` runs on push/PR

## Project Structure

```
dali-orm/
├── .github/workflows/ci.yml   # CI pipeline
├── .vite-hooks/                # Git hooks (pre-commit, pre-push, post-checkout)
├── packages/
│   ├── dali-orm/               # dali-orm — SurrealDB ORM (query builders, schema, SDK, migrations)
│   ├── dali-memory/            # dali-memory — OpenCode memory plugin (SurrealDB-backed)
│   ├── orm/                    # @dali-orm/orm — legacy ORM package
│   └── kit/                    # @dali-orm/kit — CLI tooling
├── vite.config.ts              # Root Vite+ config
├── package.json                # Root package (pnpm workspace root)
└── pnpm-workspace.yaml         # Workspace definition
```

### Package Overview

| Package                | npm name         | Description                                                                  | Has migration CLI?      |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `packages/dali-orm`    | `@woss/dali-orm` | Type-safe SurrealDB ORM with query builders, schema system, migration engine | Yes (`npx dali-orm`)    |
| `packages/dali-memory` | `dali-memory`    | OpenCode memory plugin using SurrealDB for persistence                       | Via dali-orm dependency |
| `packages/orm`         | `@dali-orm/orm`  | Legacy ORM (query builders, schema, driver layer)                            | No                      |
| `packages/kit`         | `@dali-orm/kit`  | CLI toolkit (migration commands, scaffolding)                                | Yes (`npx dali-orm`)    |

## Package Conventions

- **Entry point**: `src/index.ts` → `dist/index.js` (ESM, `"type": "module"`)
- **Build output**: `dist/` directory via `vp pack`
- **Exports**: Explicit `exports` field in `package.json` with `types` + `import` conditions
- **Migration CLI**: `dali-orm` package exposes `bin.dali-orm` pointing to `dist/migration/cli.mjs`
- **Dependencies**: Use workspace protocol (`"workspace:*"`) for inter-package deps
- **Valibot**: All public APIs validated with Valibot schemas (no manual type assertions)

## Making Changes

1. **Pull latest** and create a branch:

   ```bash
   git pull origin main
   but branch new feat/my-feature -c TASK-XXX
   ```

2. **Implement** your changes following project conventions.

3. **Run checks locally** — these run in CI so catch early:

   ```bash
   pnpm format          # vp fmt
   pnpm lint            # vp check
   pnpm typecheck       # tsc --noEmit (orm + kit packages only)
   pnpm test            # vp test run
   pnpm build           # vp pack (all packages)
   ```

4. **Commit** with a descriptive message:

   ```bash
   but commit -m "feat(dali-orm): add defaultRaw() for SurrealDB function defaults"
   ```

   Pre-commit hooks auto-run `vp check --fix` on staged files. If hooks fail, fix the issues and try again.

5. **Push** and open a pull request:
   ```bash
   but push
   ```

### Commit Convention

Descriptive messages that explain _why_, not just _what_:

- `feat(package): add feature X`
- `fix(package): correct edge case in Y`
- `refactor(package): extract shared logic into base class`
- `chore: update dependencies`

## Pull Request Process

1. PR targets the `main` branch
2. CI must pass all jobs:
   - **Lint** — `npx vp check` (Vite+ lint + format + type-check)
   - **Build** — `pnpm build` (all 4 packages)
   - **Test** — `pnpm test:cov` (all 1917 tests with coverage)
3. Coverage is reported via `vitest-coverage-report-action` — review for regressions
4. At least one maintainer review required

## Questions / Issues

- Open a GitHub issue for bugs or feature requests
- For SurrealDB-specific questions, check the [SurrealDB docs](https://surrealdb.com/docs)
- Task tracking: Backlog.md (via `backlog://` MCP)
