# Table Creation Logic in Schema Designer

## 1. Table Types & Form Options

The `TableCreatorModal` (`src/components/App/modals/table.tsx`) supports creating three table types:

| Type       | Description       | Required Fields                                |
| ---------- | ----------------- | ---------------------------------------------- |
| `normal`   | Standard table    | Table name, Schema mode                        |
| `relation` | Edge/relationship | Table name, Schema mode, In tables, Out tables |
| `view`     | Virtual table     | Table name, Schema mode, SELECT query          |

**Form Fields**:

- `tableName`: User input for table identifier
- `mode`: `schemaless` | `schemafull`
- `createType`: `normal` | `relation` | `view`
- `tableIn`/`tableOut`: Available for relations (MultiSelect of existing tables)
- `tableView`: Available for views (SELECT query)

**Validation**:

```typescript
const isValid = useMemo(() => {
  if (!tableName) return false;
  if (createType === 'relation') {
    return tableIn.length > 0 && tableOut.length > 0;
  }
  if (createType === 'view') {
    return tableView.length > 0;
  }
  return true;
}, [tableName, tableIn, tableOut, createType, tableView]);
```

## 2. TypeScript Types (src/types.tsx)

```typescript
export type SchemaMode = 'schemaless' | 'schemafull';
export type TableVariant = 'normal' | 'relation' | 'view';
export type TableType = 'ANY' | 'NORMAL' | 'RELATION';

export interface Kind {
  kind: TableType;
  enforced?: boolean;
  in?: string[]; // For RELATION type
  out?: string[]; // For RELATION type
}

export interface SchemaTable {
  name: string;
  drop: boolean;
  full: boolean; // SurrealDB 2.0
  schemafull?: boolean; // SurrealDB 3.0
  permissions: Permissions;
  kind: Kind;
  view?: string; // For VIEW type
  changefeed?: { expiry: string; store_original: boolean };
}

export interface TableInfo {
  schema: SchemaTable;
  fields: SchemaField[];
  indexes: SchemaIndex[];
  events: SchemaEvent[];
}
```

**Default TableInfo** (`src/providers/Designer/index.tsx`):

```typescript
const DEFAULT_DEF: TableInfo = {
  schema: {
    name: '',
    drop: false,
    full: false,
    kind: { kind: 'ANY' },
    permissions: { select: true, create: true, update: true, delete: true },
  },
  fields: [],
  indexes: [],
  events: [],
};
```

## 3. State Management

Form state is local to the modal component (`src/components/App/modals/table.tsx`):

```typescript
const [createType, setCreateType] = useState<TableVariant>('normal');
const [tableName, setTableName] = useState('');
const [mode, setMode] = useState<SchemaMode>('schemaless');
const [tableIn, setTableIn] = useState<string[]>([]);
const [tableOut, setTableOut] = useState<string[]>([]);
const [tableView, setTableView] = useState('');
```

On submit, creates a `TableInfo` object and passes to the DesignerProvider via `onSubmit`.

## 4. buildDefinitionQueries (src/providers/Designer/helpers.tsx)

This function transforms `TableInfo` data into SurrealQL DEFINE TABLE statements:

```typescript
export function buildDefinitionQueries({ previous, current, useOverwrite }: BuildOptions) {
  const queries: string[] = [];

  // DEFINE TABLE
  if (!equals(previous.schema, current.schema)) {
    let query = 'DEFINE TABLE';
    if (useOverwrite) query += ' OVERWRITE';
    query += ` ${escapeIdent(current.schema.name)}`;
    if (current.schema.drop) query += ' DROP';
    if (current.schema.full) query += ' SCHEMAFULL';
    else query += ' SCHEMALESS';
    query += ` TYPE ${current.schema.kind.kind}`;

    // RELATION: IN/OUT clauses
    if (current.schema.kind.in?.length) {
      query += ` IN ${current.schema.kind.in.map(escapeIdent).join(', ')}`;
    }
    if (current.schema.kind.out?.length) {
      query += ` OUT ${current.schema.kind.out.map(escapeIdent).join(', ')}`;
    }

    // ENFORCED
    if (current.schema.kind.enforced) query += ' ENFORCED';

    // VIEW
    if (current.schema.view) query += ` AS ${current.schema.view}`;

    // CHANGEFEED, PERMISSIONS...
    queries.push(query);
  }

  // REMOVE/DEFINE FIELD loop
  // REMOVE/DEFINE INDEX loop
  // REMOVE/DEFINE EVENT loop

  return ['BEGIN TRANSACTION', ...queries, 'COMMIT TRANSACTION'].join(';\n');
}
```

### Generated SurrealQL Examples

**Normal table (schemafull)**:

```sql
DEFINE TABLE my_table SCHEMAFULL TYPE NORMAL ENFORCED PERMISSIONS SELECT WHERE true;
```

**Relation table**:

```sql
DEFINE TABLE edge TYPE RELATION IN user, post OUT user, post PERMISSIONS SELECT WHERE true;
```

**View**:

```sql
DEFINE TABLE my_view AS SELECT * FROM source WHERE active = true PERMISSIONS SELECT WHERE true;
```

## 5. Query Execution

The generated query is executed via `executeQuery()` which uses the SurrealDB Stream API:

```typescript
export async function executeQuery(
  query: string,
  bindings?: Record<string, unknown>,
): Promise<QueryResponse[]> {
  const stream = instance.query(query, bindings).stream();

  for await (const frame of stream) {
    if (frame.isValue()) {
      /* collect results */
    } else if (frame.isDone()) {
      /* return success */
    } else if (frame.isError()) {
      /* return error */
    }
  }
}
```

After execution, the schema is re-synced via `syncConnectionSchema()` to reflect changes.
