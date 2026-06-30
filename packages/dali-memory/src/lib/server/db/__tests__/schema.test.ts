import { describe, test, expect } from 'vitest';
import { memoriesTable } from '../schema';

describe('memoriesTable schema', () => {
  test('exports memoriesTable without errors', () => {
    expect(memoriesTable.name).toBe('memories');
  });

  test('all columns are present', () => {
    const columnNames = memoriesTable.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual([
      'content',
      'created_at',
      'memory_type',
      'metadata',
      'name',
      'workspace_id',
    ]);
  });
});
