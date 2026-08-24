/**
 * Tests for pure functions in generate.ts
 *
 * Covers: serializeColumnPermissions, normalizeSql, detectSection,
 * addSectionSeparators, generateMigrationFile, isTableDefinition,
 * normalizeTableDefinition
 */
import { describe, expect, it } from 'vitest';
import {
  addSectionSeparators,
  detectSection,
  generateMigrationFile,
  isTableDefinition,
  normalizeSql,
  normalizeTableDefinition,
  serializeColumnPermissions,
} from '../generate.js';

// ============================================================================
// serializeColumnPermissions
// ============================================================================

describe('serializeColumnPermissions', () => {
  it('returns undefined for undefined input', () => {
    expect(serializeColumnPermissions(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(serializeColumnPermissions({})).toBeUndefined();
  });

  it('formats select true as "FOR select FULL"', () => {
    expect(serializeColumnPermissions({ select: true })).toBe('FOR select FULL');
  });

  it('formats select false as "FOR select NONE"', () => {
    expect(serializeColumnPermissions({ select: false })).toBe('FOR select NONE');
  });

  it('formats select string as "FOR select <expr>"', () => {
    expect(serializeColumnPermissions({ select: 'WHERE published = true' })).toBe(
      'FOR select WHERE published = true',
    );
  });

  it('formats create true as "FOR create FULL"', () => {
    expect(serializeColumnPermissions({ create: true })).toBe('FOR create FULL');
  });

  it('formats update false as "FOR update NONE"', () => {
    expect(serializeColumnPermissions({ update: false })).toBe('FOR update NONE');
  });

  it('formats delete string as "FOR delete <expr>"', () => {
    expect(serializeColumnPermissions({ delete: 'WHERE $auth.id = user' })).toBe(
      'FOR delete WHERE $auth.id = user',
    );
  });

  it('joins multiple permissions with comma', () => {
    expect(serializeColumnPermissions({ select: true, create: false })).toBe(
      'FOR select FULL, FOR create NONE',
    );
  });

  it('formats all four permissions', () => {
    const result = serializeColumnPermissions({
      select: true,
      create: 'WHERE role = "admin"',
      update: false,
      delete: true,
    });
    expect(result).toBe(
      'FOR select FULL, FOR create WHERE role = "admin", FOR update NONE, FOR delete FULL',
    );
  });

  it('preserves select permissions order: select, create, update, delete', () => {
    const result = serializeColumnPermissions({
      delete: true,
      select: 'WHERE active = true',
      update: true,
      create: false,
    });
    // Order should be select, create, update, delete
    const parts = result!.split(', ');
    expect(parts[0]).toBe('FOR select WHERE active = true');
    expect(parts[1]).toBe('FOR create NONE');
    expect(parts[2]).toBe('FOR update FULL');
    expect(parts[3]).toBe('FOR delete FULL');
  });
});

// ============================================================================
// normalizeSql
// ============================================================================

describe('normalizeSql', () => {
  it('compresses whitespace within lines', () => {
    expect(normalizeSql('DEFINE   TABLE   user')).toBe('DEFINE TABLE user');
  });

  it('trims leading/trailing whitespace per line', () => {
    expect(normalizeSql('  DEFINE TABLE user  ')).toBe('DEFINE TABLE user');
  });

  it('filters empty lines', () => {
    const input = 'DEFINE TABLE user;\n\n\nDEFINE TABLE post;';
    expect(normalizeSql(input)).toBe('DEFINE TABLE post;\nDEFINE TABLE user;');
  });

  it('sorts lines alphabetically', () => {
    const input = 'DEFINE TABLE z;\nDEFINE TABLE a;';
    expect(normalizeSql(input)).toBe('DEFINE TABLE a;\nDEFINE TABLE z;');
  });

  it('handles empty string', () => {
    expect(normalizeSql('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(normalizeSql('   \n  \n   ')).toBe('');
  });

  it('normalizes complex multisline SQL', () => {
    const input = `
      DEFINE FIELD email ON user TYPE string;
      DEFINE TABLE user SCHEMAFULL;
      DEFINE FIELD name   ON  user  TYPE  string;
    `;
    const result = normalizeSql(input);
    expect(result).toBe(
      'DEFINE FIELD email ON user TYPE string;\nDEFINE FIELD name ON user TYPE string;\nDEFINE TABLE user SCHEMAFULL;',
    );
  });
});

// ============================================================================
// detectSection
// ============================================================================

describe('detectSection', () => {
  it('detects DEFINE TABLE as Tables', () => {
    expect(detectSection('DEFINE TABLE user SCHEMAFULL')).toBe('Tables');
  });

  it('detects REMOVE TABLE as Tables', () => {
    expect(detectSection('REMOVE TABLE user')).toBe('Tables');
  });

  it('detects DEFINE FIELD as Tables', () => {
    expect(detectSection('DEFINE FIELD name ON user TYPE string')).toBe('Tables');
  });

  it('detects REMOVE FIELD as Tables', () => {
    expect(detectSection('REMOVE FIELD name ON user')).toBe('Tables');
  });

  it('detects DEFINE INDEX as Tables', () => {
    expect(detectSection('DEFINE INDEX idx_name ON user COLUMNS name UNIQUE')).toBe('Tables');
  });

  it('detects REMOVE INDEX as Tables', () => {
    expect(detectSection('REMOVE INDEX idx_name ON user')).toBe('Tables');
  });

  it('detects DEFINE ACCESS as Access', () => {
    expect(detectSection('DEFINE ACCESS admin ON DATABASE TYPE RECORD')).toBe('Access');
  });

  it('detects REMOVE ACCESS as Access', () => {
    expect(detectSection('REMOVE ACCESS admin ON DATABASE')).toBe('Access');
  });

  it('detects DEFINE PARAM as Params', () => {
    expect(detectSection('DEFINE PARAM $api_key TYPE string')).toBe('Params');
  });

  it('detects REMOVE PARAM as Params', () => {
    expect(detectSection('REMOVE PARAM $api_key')).toBe('Params');
  });

  it('detects DEFINE VIEW as Views', () => {
    expect(
      detectSection('DEFINE VIEW active_users AS SELECT * FROM user WHERE active = true'),
    ).toBe('Views');
  });

  it('detects REMOVE VIEW as Views', () => {
    expect(detectSection('REMOVE VIEW active_users')).toBe('Views');
  });

  it('detects DEFINE FUNCTION as Functions', () => {
    expect(detectSection('DEFINE FUNCTION fn::hello($name: string) { RETURN $name; }')).toBe(
      'Functions',
    );
  });

  it('detects REMOVE FUNCTION as Functions', () => {
    expect(detectSection('REMOVE FUNCTION fn::hello')).toBe('Functions');
  });

  it('detects DEFINE EVENT as Events', () => {
    expect(detectSection('DEFINE EVENT create_welcome ON user WHEN $before = NONE THEN ...')).toBe(
      'Events',
    );
  });

  it('detects REMOVE EVENT as Events', () => {
    expect(detectSection('REMOVE EVENT create_welcome ON user')).toBe('Events');
  });

  it('detects DEFINE ANALYZER as Analyzers', () => {
    expect(detectSection('DEFINE ANALYZER my_analyzer TOKENIZERS class')).toBe('Analyzers');
  });

  it('detects REMOVE ANALYZER as Analyzers', () => {
    expect(detectSection('REMOVE ANALYZER my_analyzer')).toBe('Analyzers');
  });

  it('returns Other for unrecognized statements', () => {
    expect(detectSection('SELECT * FROM user')).toBe('Other');
  });

  it('returns Other for empty string', () => {
    expect(detectSection('')).toBe('Other');
  });

  it('is case-insensitive', () => {
    expect(detectSection('define table user')).toBe('Tables');
    expect(detectSection('Define Access admin')).toBe('Access');
    expect(detectSection('DEFINE access admin')).toBe('Access');
  });

  it('handles leading whitespace', () => {
    expect(detectSection('  DEFINE TABLE user')).toBe('Tables');
  });
});

// ============================================================================
// addSectionSeparators
// ============================================================================

describe('addSectionSeparators', () => {
  it('returns empty array for empty input', () => {
    expect(addSectionSeparators([])).toEqual([]);
  });

  it('adds initial section header for single statement', () => {
    expect(addSectionSeparators(['DEFINE TABLE user'])).toEqual([
      '-- ---- Tables ----',
      'DEFINE TABLE user',
    ]);
  });

  it('adds initial header for same-section statements without extra separators', () => {
    const stmts = ['DEFINE TABLE user', 'DEFINE FIELD name ON user'];
    expect(addSectionSeparators(stmts)).toEqual([
      '-- ---- Tables ----',
      'DEFINE TABLE user',
      'DEFINE FIELD name ON user',
    ]);
  });

  it('inserts separator between different sections', () => {
    const result = addSectionSeparators([
      'DEFINE TABLE user',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
    ]);
    expect(result).toEqual([
      '-- ---- Tables ----',
      'DEFINE TABLE user',
      '-- ---- Access ----',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
    ]);
  });

  it('handles multiple section transitions', () => {
    const result = addSectionSeparators([
      'DEFINE TABLE user',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
      'DEFINE FUNCTION fn::hello() { RETURN "hi"; }',
    ]);
    expect(result).toEqual([
      '-- ---- Tables ----',
      'DEFINE TABLE user',
      '-- ---- Access ----',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
      '-- ---- Functions ----',
      'DEFINE FUNCTION fn::hello() { RETURN "hi"; }',
    ]);
  });

  it('handles transition from unknown section', () => {
    const result = addSectionSeparators(['SELECT 1', 'DEFINE TABLE user']);
    expect(result).toEqual([
      '-- ---- Other ----',
      'SELECT 1',
      '-- ---- Tables ----',
      'DEFINE TABLE user',
    ]);
  });

  it('handles same section after separator', () => {
    const stmts = [
      'DEFINE TABLE user',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
      'DEFINE FIELD email ON user',
    ];
    const result = addSectionSeparators(stmts);
    // user → Access separator, then email is Tables again → another separator
    expect(result).toEqual([
      '-- ---- Tables ----',
      'DEFINE TABLE user',
      '-- ---- Access ----',
      'DEFINE ACCESS admin ON DATABASE TYPE RECORD',
      '-- ---- Tables ----',
      'DEFINE FIELD email ON user',
    ]);
  });
});

// ============================================================================
// generateMigrationFile
// ============================================================================

describe('generateMigrationFile', () => {
  it('generates minimal file with up section', () => {
    const result = generateMigrationFile('001', 'create_user', {
      up: ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
    });
    expect(result).toContain('-- Migration: create_user');
    expect(result).toContain('-- Version: 001');
    expect(result).toContain('-- UP');
    expect(result).toContain('DEFINE TABLE user SCHEMAFULL;');
    expect(result).toContain('DEFINE FIELD name ON user TYPE string;');
  });

  it('filters empty statements from up', () => {
    const result = generateMigrationFile('001', 'test', {
      up: ['DEFINE TABLE user SCHEMAFULL', '', ' ', 'DEFINE FIELD name ON user TYPE string'],
    });
    // Only the two non-empty statements get through (empty/whitespace filtered)
    expect(result).toContain('DEFINE TABLE user SCHEMAFULL;');
    expect(result).toContain('DEFINE FIELD name ON user TYPE string;');
    // No trace of empty/whitespace entries in output
    expect(result).not.toMatch(/\n;\n/);
  });

  it('handles empty up', () => {
    const result = generateMigrationFile('001', 'test', { up: [] });
    expect(result).toContain('-- UP\n\n');
  });

  it('generates up-only migration content', () => {
    const result = generateMigrationFile('001', 'test', { up: ['DEFINE TABLE user'] });
    expect(result).toContain('DEFINE TABLE user;');
  });

  it('adds section separators between statement categories', () => {
    const result = generateMigrationFile('001', 'test', {
      up: ['DEFINE TABLE user SCHEMAFULL', 'DEFINE ACCESS admin ON DATABASE TYPE RECORD'],
    });
    expect(result).toContain('-- ---- Access ----');
  });

  it('does not add semicolons to comment lines', () => {
    const result = generateMigrationFile('001', 'test', {
      up: ['DEFINE TABLE user'],
    });
    const lines = result.split('\n');
    const commentLines = lines.filter((l) => l.startsWith('--'));
    for (const cl of commentLines) {
      expect(cl.endsWith(';;')).toBe(false);
    }
  });
});

// ============================================================================
// isTableDefinition
// ============================================================================

describe('isTableDefinition', () => {
  it('returns false for null', () => {
    expect(isTableDefinition(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTableDefinition(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isTableDefinition('string')).toBe(false);
    expect(isTableDefinition(42)).toBe(false);
    expect(isTableDefinition(true)).toBe(false);
  });

  it('returns false for object without name', () => {
    expect(isTableDefinition({})).toBe(false);
  });

  it('returns false for object without columns', () => {
    expect(isTableDefinition({ name: 'user' })).toBe(false);
  });

  it('returns false for object without config', () => {
    expect(isTableDefinition({ name: 'user', columns: [] })).toBe(false);
  });

  it('returns true for valid TableDefinition', () => {
    expect(
      isTableDefinition({
        name: 'user',
        columns: [],
        config: { schema: 'full', type: 'normal' },
      }),
    ).toBe(true);
  });

  it('returns true for SurrealTableInstance ($name + $columns)', () => {
    expect(
      isTableDefinition({
        $name: 'user',
        $columns: {},
        columns: [],
        config: { schema: 'full', type: 'normal' },
      }),
    ).toBe(true);
  });

  it('returns true when name is from $name and columns from $columns', () => {
    // SurrealTableInstance with $name but maybe no regular name
    expect(
      isTableDefinition({
        $name: 'user',
        $columns: {},
        columns: [],
        config: { schema: 'full', type: 'normal' },
      }),
    ).toBe(true);
  });
});

// ============================================================================
// normalizeTableDefinition
// ============================================================================

describe('normalizeTableDefinition', () => {
  it('returns null for null', () => {
    expect(normalizeTableDefinition(null)).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(normalizeTableDefinition('string')).toBeNull();
  });

  it('returns null for object without name', () => {
    expect(normalizeTableDefinition({ columns: [], config: {} })).toBeNull();
  });

  it('returns null for object without columns', () => {
    expect(normalizeTableDefinition({ name: 'user', config: {} })).toBeNull();
  });

  it('returns null for object without config', () => {
    expect(normalizeTableDefinition({ name: 'user', columns: [] })).toBeNull();
  });

  it('normalizes valid table with defaults', () => {
    const result = normalizeTableDefinition({
      name: 'user',
      columns: [],
      config: {},
    });
    expect(result).toEqual({
      name: 'user',
      columns: [],
      config: {
        schema: 'full',
        type: 'normal',
        in: undefined,
        out: undefined,
        permissions: undefined,
        indexes: undefined,
        changefeed: undefined,
      },
    });
  });

  it('preserves explicit config values', () => {
    const result = normalizeTableDefinition({
      name: 'edge',
      columns: [{ name: 'in', config: { type: 'string' }, tableName: 'edge' }],
      config: {
        schema: 'full',
        type: 'relation',
        in: 'user',
        out: 'post',
        permissions: { select: 'NONE' },
      },
    });
    expect(result).toEqual({
      name: 'edge',
      columns: [{ name: 'in', config: { type: 'string' }, tableName: 'edge' }],
      config: {
        schema: 'full',
        type: 'relation',
        in: 'user',
        out: 'post',
        permissions: { select: 'NONE' },
        indexes: undefined,
        changefeed: undefined,
      },
    });
  });

  it('converts SurrealTableInstance via $columns', () => {
    const result = normalizeTableDefinition({
      $name: 'user',
      $columns: {
        name: { name: 'name', config: { type: 'string' }, tableName: 'user' },
      },
      config: { schema: 'full', type: 'normal' },
    });
    expect(result).toEqual({
      name: 'user',
      columns: [{ name: 'name', config: { type: 'string' }, tableName: 'user' }],
      config: {
        schema: 'full',
        type: 'normal',
        in: undefined,
        out: undefined,
        permissions: undefined,
        indexes: undefined,
        changefeed: undefined,
      },
    });
  });

  it('prefers name over $name when both exist', () => {
    const result = normalizeTableDefinition({
      name: 'actual_name',
      $name: 'alias_name',
      columns: [],
      config: { schema: 'full', type: 'normal' },
    });
    expect(result?.name).toBe('actual_name');
  });

  it('uses $name when name is not a string', () => {
    const result = normalizeTableDefinition({
      $name: 'from_alias',
      columns: [],
      config: { schema: 'full', type: 'normal' },
    });
    expect(result?.name).toBe('from_alias');
  });
});
