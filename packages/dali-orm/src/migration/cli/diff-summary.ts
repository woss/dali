import type { TableDefinition } from '../../sdk/table.js';
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition } from '../../sdk/table.js';
import type {
  SerializedAccess,
  SerializedEvent,
  SerializedFunction,
  SerializedAnalyzer,
} from '../core/snapshot.js';

/**
 * Print a summary of schema changes
 */
export interface NonTableChangeCounts {
  added: number;
  removed: number;
}

export function getNonTableChanges(
  current: {
    access?: AccessConfig[];
    events?: EventConfig[];
    functions?: FunctionConfig[];
    analyzers?: AnalyzerDefinition[];
  },
  last: {
    access: SerializedAccess[];
    events: SerializedEvent[];
    functions: SerializedFunction[];
    analyzers: SerializedAnalyzer[];
  },
): NonTableChangeCounts {
  let added = 0;
  let removed = 0;

  const lastAccessNames = new Set(last.access.map((a) => a.name));
  const currentAccessNames = new Set((current.access ?? []).map((a) => a.name));
  added += current.access?.filter((a) => a.name && !lastAccessNames.has(a.name)).length ?? 0;
  removed += last.access.filter((a) => !currentAccessNames.has(a.name)).length;

  const lastEventKeys = new Set(last.events.map((e) => `${e.what}:${e.name}`));
  const currentEventKeys = new Set((current.events ?? []).map((e) => `${e.on}:${e.name}`));
  added +=
    current.events?.filter((e) => e.name && !lastEventKeys.has(`${e.on}:${e.name}`)).length ?? 0;
  removed += last.events.filter((e) => !currentEventKeys.has(`${e.what}:${e.name}`)).length;

  const lastFunctionNames = new Set(last.functions.map((f) => f.name));
  const currentFunctionNames = new Set((current.functions ?? []).map((f) => f.name));
  added += current.functions?.filter((f) => f.name && !lastFunctionNames.has(f.name)).length ?? 0;
  removed += last.functions.filter((f) => !currentFunctionNames.has(f.name)).length;

  const lastAnalyzerNames = new Set(last.analyzers.map((a) => a.name));
  const currentAnalyzerNames = new Set((current.analyzers ?? []).map((a) => a.name));
  added += current.analyzers?.filter((a) => a.name && !lastAnalyzerNames.has(a.name)).length ?? 0;
  removed += last.analyzers.filter((a) => !currentAnalyzerNames.has(a.name)).length;

  return { added, removed };
}

export function printDiffSummary(
  diff: {
    added: {
      tables: TableDefinition[];
      fields: Array<{ table: string; column: ColumnDefinition }>;
      indexes: Array<{ table: string; index: { name: string } }>;
    };
    removed: {
      tables: string[];
      fields: Array<{ table: string; field: string }>;
      indexes: Array<{ table: string; name: string }>;
    };
    changed: { tables: Array<{ name: string }>; fields: Array<{ table: string; field: string }> };
  },
  _currentAccess?: any[],
  _lastAccess?: { name: string }[],
  nonTable?: NonTableChangeCounts,
): void {
  const nonTableAdded = nonTable?.added ?? 0;
  const nonTableRemoved = nonTable?.removed ?? 0;
  const totalChanges =
    diff.added.tables.length +
    diff.added.fields.length +
    diff.added.indexes.length +
    diff.removed.tables.length +
    diff.removed.fields.length +
    diff.removed.indexes.length +
    diff.changed.tables.length +
    diff.changed.fields.length +
    nonTableAdded +
    nonTableRemoved;

  if (totalChanges === 0) {
    console.log('No changes detected.');
    return;
  }

  console.log('\nMigration Summary:');
  console.log('==================');

  if (diff.added.tables.length > 0) {
    console.log(`+ Tables: ${diff.added.tables.map((t) => t.name).join(', ')}`);
  }
  if (diff.added.fields.length > 0) {
    console.log(
      `+ Fields: ${diff.added.fields.map((f) => `${f.table}.${f.column.name}`).join(', ')}`,
    );
  }
  if (diff.added.indexes.length > 0) {
    console.log(
      `+ Indexes: ${diff.added.indexes.map((i) => `${i.table}.${i.index.name}`).join(', ')}`,
    );
  }
  if (diff.removed.tables.length > 0) {
    console.log(`- Tables: ${diff.removed.tables.join(', ')}`);
  }
  if (diff.removed.fields.length > 0) {
    console.log(`- Fields: ${diff.removed.fields.map((f) => `${f.table}.${f.field}`).join(', ')}`);
  }
  if (diff.removed.indexes.length > 0) {
    console.log(`- Indexes: ${diff.removed.indexes.map((i) => `${i.table}.${i.name}`).join(', ')}`);
  }
  if (diff.changed.tables.length > 0) {
    console.log(`~ Changed tables: ${diff.changed.tables.map((t) => t.name).join(', ')}`);
  }
  if (diff.changed.fields.length > 0) {
    console.log(
      `~ Changed fields: ${diff.changed.fields.map((f) => `${f.table}.${f.field}`).join(', ')}`,
    );
  }
  if (nonTableAdded > 0) {
    console.log(`+ Analyzers/Access/Events/Functions: ${nonTableAdded} new`);
  }
  if (nonTableRemoved > 0) {
    console.log(`- Analyzers/Access/Events/Functions: ${nonTableRemoved} removed`);
  }
}

/**
 * Detect section category for a SurrealQL statement
 */
export function detectSection(stmt: string): string {
  const upper = stmt.trim().toUpperCase();
  if (
    upper.startsWith('DEFINE TABLE') ||
    upper.startsWith('REMOVE TABLE') ||
    upper.startsWith('DEFINE FIELD') ||
    upper.startsWith('REMOVE FIELD') ||
    upper.startsWith('DEFINE INDEX') ||
    upper.startsWith('REMOVE INDEX')
  ) {
    return 'Tables';
  }
  if (upper.startsWith('DEFINE ACCESS') || upper.startsWith('REMOVE ACCESS')) {
    return 'Access';
  }
  if (upper.startsWith('DEFINE PARAM') || upper.startsWith('REMOVE PARAM')) {
    return 'Params';
  }
  if (upper.startsWith('DEFINE VIEW') || upper.startsWith('REMOVE VIEW')) {
    return 'Views';
  }
  if (upper.startsWith('DEFINE FUNCTION') || upper.startsWith('REMOVE FUNCTION')) {
    return 'Functions';
  }
  if (upper.startsWith('DEFINE EVENT') || upper.startsWith('REMOVE EVENT')) {
    return 'Events';
  }
  if (upper.startsWith('DEFINE ANALYZER') || upper.startsWith('REMOVE ANALYZER')) {
    return 'Analyzers';
  }
  return 'Other';
}

/**
 * Insert section separator comments between statement categories
 */
export function addSectionSeparators(statements: string[]): string[] {
  const result: string[] = [];
  let currentSection = '';

  for (const stmt of statements) {
    const section = detectSection(stmt);
    if (section !== currentSection) {
      result.push(`-- ---- ${section} ----`);
      currentSection = section;
    }
    result.push(stmt);
  }

  return result;
}
