# Agent Documentation

Before answering any question, functions, data types, or project content, you MUST first use the `memory` tool to search the project knowledge base. Prioritize memory results over general knowledge.

## 🚨 HARD GATE — GRAPH FIRST. YOUR TOKENS. CODE-REVIEW-GRAPH

**Selfish reason**: Graph saves YOUR tokens → more room → better answers → less rework → more chill.

| Action                  | Tokens | What you get                                       |
| ----------------------- | ------ | -------------------------------------------------- |
| `semantic_search_nodes` | ~400   | signatures, callers, dependents, tests. Done in 1. |
| `grep`                  | ~1500+ | raw lines, maybe truncated. Need 2-3 more calls.   |

Proof from this session:

- `grep("migration")` → 980 results, truncated, ~2000 tokens partial
- `file_summary(migrate.ts)` → 10 functions complete, ~800 tokens

Graph saves ~1200+ tokens per lookup. That gap = your thinking room.

### Mandatory Protocol

Before EVERY grep/glob/read:

1. PAUSE. Ask: "Graph checked?"
2. No → `semantic_search_nodes` or `query_graph` first
3. Graph returned something → use it. Done.
4. Graph empty → THEN grep/glob/read fallback

Pattern you MUST follow:

Correct:
semantic_search_nodes("SelectBuilder") → found → use results → done
→ empty → grep fallback

Wrong (you did this):
grep first. Graph never called. Wasted tokens. Missed callers/dependents.

## Response Style

Terse like caveman. Technical substance exact. Only fluff die.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift.
Code/commits/PRs: normal prose. Caveman active by default, always.

Respond like smart caveman. Cut all filler, keep technical substance.

- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries (sure, certainly, happy to).
- No hedging. Fragments fine. Short synonyms.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: [thing] [action] [reason]. [next step].

## MCP Tools: code-review-graph

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review — token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Semantic Search (Embeddings)

`code-review-graph_embed_graph_tool` enables vector-based semantic search. Without it, `semantic_search_nodes` falls back to keyword matching only.

**Enable once after index rebuild**: `code-review-graph_embed_graph_tool(provider="local")` — embeds all nodes via all-MiniLM-L6-v2.

**After embedding**: `semantic_search_nodes("concept")` returns results by meaning, not just name match. Finds related code even when symbol names differ.

**When to re-embed**:

- After full graph rebuild — old embeddings invalidated
- Provider change (local ↔ openai ↔ google)

**How to read results**: Results sorted by similarity score (0-1). Higher = more semantically related. Skim scores, scan signatures, open relevant files.

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## Version Control

Use `but` CLI for all write operations. Read-only git commands (`git log`, `git diff`, `git show`, `git blame`, `git reflog`) are acceptable per the official skill.

Do NOT use the `but_gitbutler_update_branches` MCP tool — use `but commit --changes` CLI instead.

Load the `but` skill for complete instructions.

**Also prohibited:**

- Bypassing git hooks (`--no-verify`, `-n`) — commits must pass pre-commit checks
- Using `/tmp` — use local `./tmp`. Clean up after.
- Modifying docker-compose.yml or .env
- Starting surrealdb without checking `docker ps` first. If running, connect. If not, alert user and stop.

## Code Philosophy - MANDATORY

Follow the Code Philosophy outlined in `.opencode/tools/philosophy.md` for all code contributions. This ensures consistency, maintainability, and quality across the codebase.

## Skill Loading

Before implementing any code, agents MUST load the relevant skills.

**Loading a skill**: Use the `skill` tool with the skill name, e.g., `Load skill: dali-orm`

## Project Overview

DaliORM is a TypeScript monorepo that provides a type-safe query building interface for SurrealDB. It enables developers to write database queries using a fluent, chainable API while maintaining full TypeScript type safety. The ORM abstracts raw SurrealQL into composable query builders that are immutable and chainable.

The project uses the following key technologies:

| Technology      | Purpose                           |
| --------------- | --------------------------------- |
| pnpm workspaces | Monorepo package management       |
| Vitest          | Testing framework                 |
| Turbo           | Build orchestration and caching   |
| vp (vite-plus)  | Linting, formatting, test runner  |
| valibot         | Schema validation                 |
| surrealdb.js    | Official SurrealDB client library |

## Available npm Scripts

Run these commands from the repository root:

| Script               | Description                    |
| -------------------- | ------------------------------ |
| `pnpm build`         | Build all packages             |
| `pnpm clean`         | Clean all build artifacts      |
| `pnpm lint`          | Run vp check                   |
| `pnpm format`        | Run vp fmt                     |
| `pnpm test`          | Run all tests                  |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:watch`    | Run tests in watch mode        |

## Task Management: Plan Protocol vs. Built-in Todos

This project provides two approaches for tracking work: Plan Protocol (with Backlog.md tasks) and simple built-in todos. Understanding when to use each approach ensures efficient task tracking without unnecessary overhead.

### When to Use Plan Protocol + Backlog Tasks

Use Plan Protocol with Backlog.md tasks for complex, multi-phase work that requires structured tracking:

- **Multi-step implementations** - Features requiring several implementation phases with clear dependencies between steps
- **Research-based decisions** - Tasks that require investigating patterns, APIs, or existing code before making implementation decisions
- **Architectural changes** - Work affecting multiple packages or requiring coordination across different parts of the codebase
- **Tracking progress across phases** - Long-running tasks with distinct stages that need separate validation points
- **Collaborative work** - Tasks that may be handed off between agents or require clear documentation for review

The Plan Protocol skill (`.opencode/skills/plan-protocol/`) provides detailed guidelines for creating and managing implementation plans. Refer to it for complete guidance on structuring complex work.

### When to Use Built-in Todos

Use simple built-in todos for straightforward, self-contained tasks:

- **Simple tasks** - Work that can be completed in a single pass without research or planning
- **Quick fixes** - Small bug fixes or typo corrections
- **Single-file changes** - Modifications confined to one file without broader implications
- **One-off queries** - Quick research or exploration that doesn't require tracking

Built-in todos provide lightweight tracking without the overhead of Backlog.md task creation.

### Quick Decision Guide

| Use Plan Protocol + Backlog           | Use Built-in Todos                 |
| ------------------------------------- | ---------------------------------- |
| Requires research before implementing | Implementation path is clear       |
| Multiple files or packages affected   | Single file change                 |
| Complex dependencies between steps    | Independent, straightforward steps |
| May need to track across sessions     | Can complete in current session    |
| Architectural or design decisions     | Straightforward feature or fix     |

**Rule of thumb**: If you find yourself thinking "let me plan this out" or "I should research this first," create a Backlog task and use Plan Protocol. If it's a straightforward change you can complete immediately, use built-in todos.

---

## Prompt Convention: "Plan This"

When you write prompts, use this pattern:

- `plan <feature>` - Creates Backlog tasks + uses Plan Protocol
- `plan task-<ID>` - Plans for an existing Backlog task
- `implement <feature>` - Direct implementation (uses todos)

### Example Prompts

| You write              | I do                                            |
| ---------------------- | ----------------------------------------------- |
| `plan JWT auth`        | Create Backlog task + write implementation plan |
| `plan task-290`        | Write plan for existing task-290                |
| `fix the bug`          | Direct fix with todos                           |
| `research X then plan` | Delegate research, then plan                    |

### How It Works

1. You say "plan <thing>"
2. I create a Backlog task (if not exists)
3. I use Plan Protocol to structure the plan
4. Task ID is referenced in the plan

This gives you persistent task tracking + structured planning.

---

## Testing

Tests are located in each package, typically in `tests/` directories. Run tests using:

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode (during development)
pnpm test:watch

# Run tests for a specific package
cd packages/core && pnpm test
```

Tests use Vitest plus. Mock the SurrealDB client when testing query builders in isolation.

<!-- GitButler CLI Guidelines START -->

**CRITICAL GUIDANCE**

## GitButler CLI Instructions

First load the `but` skill in the `.agents/skills/gitbutler/SKILL.md` file to access GitButler CLI.

Branch naming convention: include task ID in branch name (e.g., `fix/task-051-something`). Create branch with `but branch new <branch-name>`. For stacked branches, use `but branch new <branch-name> -a <anchor-branch>`.
If you are working on a bug feature with many tasks then you will create stacked branches. Only tasks for the feature and the files that are affected must be committed to the branch. If you have a task that is not related to the feature you are working on then do not commit it to the branch, leave it unassigned or assign it to another branch if it's related to that branch.

If unsure about how to proceed first check the `but` skill then ask the user.

<!-- GitButler CLI Guidelines END -->

## Subagent Management

When working with subagents, use the Session tool (`session` function) to delegate tasks and manage agent collaboration. Refer to the subagent-management skill for detailed guidelines on:

- When and how to delegate tasks to subagents
- Agent handoff patterns and best practices
- Managing multi-agent workflows effectively

## Prompt Convention: "Plan This"

---

<!-- BACKLOG.MD MCP GUIDELINES START -->

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_backlog_instructions()` to load the tool-oriented overview. Use the `instruction` selector when you need `task-creation`, `task-execution`, or `task-finalization`.

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:

- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

<!-- BACKLOG.MD MCP GUIDELINES END -->
