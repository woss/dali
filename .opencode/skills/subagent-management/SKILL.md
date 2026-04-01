---
name: subagent-management
description: Guidelines for effectively delegating work to subagents using delegate and task tools, including prompt structure, result handling, and collaboration patterns
---

# Subagent Management

## TL;DR

Use subagents for parallel research and independent work. Structure prompts with clear context, specific objectives, and expected output format. Always handle results properly and avoid polling—wait for notifications.

## When to Use Subagents

- **Research tasks** — Investigating patterns, APIs, or existing code
- **Parallel work** — Multiple independent investigations can run simultaneously
- **Background work** — Tasks that don't block your primary workflow
- **Focused exploration** — Deep dives into specific areas without distracting main context

Do NOT use subagents for:

- Simple one-off questions you can answer directly
- Tasks requiring immediate feedback
- Work that needs tight iteration with the main agent

## The Three Collaboration Patterns

### 1. COLLABORATE (message)

Turn-based collaboration in the same conversation. Perfect for complex problems requiring multiple perspectives.

```typescript
session({
  mode: 'message',
  agent: 'plan',
  text: 'Should we use microservices here?',
});
```

Use for: Architecture discussions, design reviews, strategy debates

### 2. HANDOFF (new)

Clean phase transitions with fresh context. Complete one phase, hand off to another agent with a clean slate.

```typescript
session({
  mode: 'new',
  agent: 'researcher',
  text: 'Research best practices for API design',
});
```

Use for: Research → Implementation → Validation workflows

### 3. PARALLELIZE (fork)

Explore multiple approaches simultaneously. Branch into independent sessions to try different solutions.

```typescript
session({ mode: 'fork', agent: 'build', text: 'Implement using Redux' });
session({ mode: 'fork', agent: 'build', text: 'Implement using Context API' });
```

Use for: Exploring alternatives, A/B approaches, spike solutions

## Delegate Tool (Read-only Subagents)

The `delegate` tool launches a task and returns immediately with an ID. Use for read-only work (research, exploration).

**Parameters:**

- `prompt` — Detailed instructions for the subagent
- `agent` — Agent type (typically not specified for general delegation)

**Behavior:**

- Returns immediately with a delegation ID
- Runs asynchronously in background
- Notification arrives when complete
- Use `delegation_read(id)` to retrieve results

**Example:**

```typescript
delegate({
  prompt:
    "Search the codebase for all usages of the `select` function in packages/core/src. List each file, line number, and the context in which it's used. Focus on understanding the query builder patterns.",
  agent: 'researcher',
});
```

## Task Tool (Write-capable Subagents)

The `task` tool creates a native task that preserves undo/branching. Use when subagents need write permissions.

**Parameters:**

- Same as delegate but runs with full write capabilities

**When to use task over delegate:**

- Subagent will create or modify files
- Subagent needs to run commands
- Changes need to be tracked in the same branch context

## Prompt Structure

Effective subagent prompts include:

### 1. Context Setup

What background information does the subagent need?

```
The codebase is a TypeScript monorepo with packages/core, packages/driver, and packages/kit.
We're working on adding migration support to packages/kit.
```

### 2. Specific Objective

What exactly should the subagent accomplish?

```
Find all existing migration-related code in the codebase, including:
- Migration patterns used in other parts of the system
- CLI argument parsing patterns in packages/kit
- How other tools handle database schema changes
```

### 3. Output Format

How should results be structured?

```
Provide a summary with:
1. File paths and line numbers for each finding
2. Brief description of what each does
3. Whether it could be reused for migration implementation
```

### 4. Constraints

Any limits on scope or approach?

```
Focus only on packages/kit and packages/core. Don't look at examples/.
Limit to 10 most relevant findings.
```

## Result Handling

### Retrieving Results

After receiving notification:

```typescript
const results = delegation_read(id);
```

### Handling Errors

If a delegation fails:

- Check the error message in results
- Determine if it's a prompt issue or execution issue
- Consider re-delegating with corrected instructions

### Merging Results

When multiple parallel delegations complete:

1. Read each result individually
2. Synthesize findings
3. Present unified analysis to user
4. Proceed with implementation based on findings

## Critical Rules

### NEVER Poll

Do NOT use `delegation_list()` to check completion. You WILL be notified via `<task-notification>`. Polling wastes tokens and indicates poor architecture.

### NEVER Wait Idle

Always have productive work while delegations run. Continue with your primary task, check notifications periodically.

### Use Appropriate Tool

- Read-only work → `delegate`
- Write-capable work → `task`

Using the wrong tool will fail fast with guidance—pay attention to the error message.

### Provide Adequate Context

Subagents need enough context to be effective. Under-specified prompts produce underwhelming results.

### Handle Results Properly

Always retrieve and synthesize delegation results before proceeding. Don't assume success—verify.

## Agent Routing

| Agent Type              | Tool       | Use Case                                |
| ----------------------- | ---------- | --------------------------------------- |
| Read-only subagents     | `delegate` | Background research, exploration        |
| Write-capable subagents | `task`     | Implementation work, file modifications |

Available primary agents:

- `plan` — Strategic planning agent
- `build` — General-purpose implementation agent

## GitButler Branch Management

When subagents need to make commits or manage branches, use the GitButler CLI (`but`).

### Core Workflow

1. **Sync first** → `but pull` to get latest upstream
2. **Check state** → `but status --json`
3. **Create branch** → `but branch new <name>` or reuse existing
4. **Make changes** → Edit files as needed
5. **Commit** → `but commit <branch> -m "message" --changes <id>,<id>`

### Essential Commands

```bash
but status --json              # View workspace state
but branch new <name>          # Create new branch
but commit <branch> -m "msg" --changes <ids>  # Commit specific files
but push <branch>              # Push to remote
```

### Branch Naming

Use conventional prefixes: `feat/`, `fix/`, `chore/`, `refactor/`

### Hard Safety Rules

1. **Never discard changes you did not create** — unassigned changes in `zz` may belong to other agents
2. **Always assign your changes to a branch** — don't leave edits in `zz`
3. **Validate branch ownership before commit** — confirm files belong to the intended branch

### Key Differences from Traditional Git

- GitButler allows multiple branches simultaneously (workspace model)
- Use `but` commands instead of `git` for write operations
- Read-only git commands are fine (`git log`, `git diff`)

### Getting Commit IDs

- **File IDs**: `but status --json` — commit entire files
- **Hunk IDs**: `but diff --json` — commit individual hunks

### Post-Merge Workflow

After PR merge:

```bash
but unapply <merged-branch>    # MUST do before pull
but pull                        # Pull merged changes
```

## Adherence Checklist

Before delegating work, verify:

- [ ] Task is appropriate for subagent (not simple/urgent)
- [ ] Prompt includes context, objective, output format, constraints
- [ ] Using correct tool (delegate vs task)
- [ ] Not waiting idle—productive work arranged in parallel

After receiving results:

- [ ] Retrieved results with `delegation_read`
- [ ] Synthesized findings from multiple delegations
- [ ] Presented unified analysis before proceeding

## Critical Branch Instructions

### Hard Safety Rules

1. **Never use git commands that modify commit history** — Never run `git rebase`, `git reset`, or `git commit --amend` without explicit instructions. Always use the `but` skill for branch and commit management.

2. **Always use the `but` skill for branch operations** — For creating branches, committing changes, and pushing, use the GitButler CLI (`but`) commands instead of raw git.

3. **Load the but skill first** — Before performing any git operations, load the but skill from `.agents/skills/but/SKILL.md` to access GitButler's MCP features for advanced git operations.

4. **Branch naming convention** — Get the task ID from the backlog MCP, then create branch with `but branch new <branch-name> -c <task-id>`.

5. **Stacked branches for multi-task features** — If working on a feature with many tasks, create stacked branches. Only commit files related to the feature to that branch. Leave unrelated changes unassigned or assign to a different branch.

6. **Never discard changes you did not create** — Unassigned changes in `zz` may belong to other agents. Confirm file ownership before committing.

7. **Always assign your changes to a branch** — Don't leave edits in `zz`. Use `but status --json` to view workspace state and identify which branch owns each file.

### Key Differences from Traditional Git

- GitButler allows multiple branches simultaneously (workspace model)
- Use `but` commands instead of `git` for write operations
- Read-only git commands are fine (`git log`, `git diff`, `git status`)

### If Unsure

Check the `but` skill documentation or ask the user for guidance before proceeding.
