---
id: TASK-009
title: Auto-generate REST API for defined tables
status: Done
assignee: []
created_date: '2026-04-24 22:10'
updated_date: '2026-04-24 22:15'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add config option to automatically generate REST API endpoints for tables defined with defineTable().

## Feature Request

When user sets `enableApi: true` in config, automatically generate CRUD endpoints:

- GET /tables - List all tables
- GET /table/:id - Get record by ID
- POST /table - Create record
- PUT /table/:id - Update record
- DELETE /table/:id - Delete record

## Implementation

1. Add `enableApi?: boolean` to SurrealORMConfig
2. Add `apiPrefix?: string` for API route prefix
3. Create API route generation from TableDefinition
4. Integrate with connection to expose HTTP endpoints

## Usage

```typescript
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  enableApi: true,
  apiPrefix: '/api',
});

// Auto-generates endpoints:
// GET /api/users
// GET /api/users/:id
// POST /api/users
// PUT /api/users/:id
// DELETE /api/users/:id
```

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented REST API generation feature for SurrealORM.

## Features Added

| Feature                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `enableApi: true`       | Enable automatic REST API                 |
| `apiPrefix`             | Custom API route prefix (default: '/api') |
| `openApi: true`         | Generate OpenAPI 3.0 schema               |
| `handleApiRequest()`    | Handle HTTP requests                      |
| `generateOpenApiSpec()` | Generate OpenAPI spec                     |
| `getApiRoutes()`        | List available routes                     |

## Usage

```typescript
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  schemas: { user: usersTable },
  enableApi: true,
  apiPrefix: '/api',
  openApi: true,
});

// Express.js integration
app.all('/api/:table/:id?', (req, res) => {
  const result = await orm.handleApiRequest(req.method, req.path, req.body, req.params);
  res.status(result.status).json(result.data);
});

// Generate OpenAPI spec
const spec = orm.generateOpenApiSpec();

// Get routes
const routes = orm.getApiRoutes();
```

## Tests

All 550 tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
