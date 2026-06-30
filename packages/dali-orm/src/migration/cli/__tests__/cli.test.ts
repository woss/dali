/**
 * Tests for pure functions in cli.ts
 *
 * Covers: slugify(), parseGlobalOptions()
 * Does NOT test main() since it depends on process.argv, loadConfig, and sub-handlers.
 */
import { describe, expect, it } from 'vite-plus/test';
import { parseGlobalOptions, slugify } from '../../cli.js';

// ============================================================================
// slugify
// ============================================================================

describe('slugify', () => {
  it('converts spaces to underscores', () => {
    expect(slugify('add user table')).toBe('add_user_table');
  });

  it('removes special characters', () => {
    expect(slugify('Fix Bug!')).toBe('fix_bug');
    expect(slugify('Create @User Table')).toBe('create_user_table');
  });

  it('handles already snake_case', () => {
    expect(slugify('already_snake_case')).toBe('already_snake_case');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('lowercases mixed case', () => {
    expect(slugify('AddUserTable')).toBe('addusertable');
    expect(slugify('ADD USER TABLE')).toBe('add_user_table');
  });

  it('trims leading/trailing underscores', () => {
    expect(slugify('_add_user_')).toBe('add_user');
  });

  it('collapses multiple spaces', () => {
    expect(slugify('add   user   table')).toBe('add_user_table');
  });

  it('replaces hyphens with underscores', () => {
    expect(slugify('add-user-table')).toBe('add_user_table');
  });

  it('handles mixed spaces and hyphens', () => {
    expect(slugify('add-user  table test')).toBe('add_user_table_test');
  });

  it('trims leading/trailing whitespace before processing', () => {
    expect(slugify('  add user  ')).toBe('add_user');
  });
});

// ============================================================================
// parseGlobalOptions
// ============================================================================

describe('parseGlobalOptions', () => {
  it('parses --config with value', () => {
    const opts = parseGlobalOptions(['--config', 'my-config.ts']);
    expect(opts.config).toBe('my-config.ts');
  });

  it('parses -c alias for --config', () => {
    const opts = parseGlobalOptions(['-c', 'config.ts']);
    expect(opts.config).toBe('config.ts');
  });

  it('parses --dry-run', () => {
    const opts = parseGlobalOptions(['--dry-run']);
    expect(opts.dryRun).toBe(true);
  });

  it('parses -n alias for --dry-run', () => {
    const opts = parseGlobalOptions(['-n']);
    expect(opts.dryRun).toBe(true);
  });

  it('parses --force / -f', () => {
    expect(parseGlobalOptions(['--force']).force).toBe(true);
    expect(parseGlobalOptions(['-f']).force).toBe(true);
  });

  it('parses --to with value', () => {
    const opts = parseGlobalOptions(['--to', '001']);
    expect(opts.to).toBe('001');
  });

  it('parses --name / -m', () => {
    expect(parseGlobalOptions(['--name', 'test']).name).toBe('test');
    expect(parseGlobalOptions(['-m', 'test']).name).toBe('test');
  });

  it('parses --output / -o', () => {
    expect(parseGlobalOptions(['--output', './out']).output).toBe('./out');
    expect(parseGlobalOptions(['-o', './out']).output).toBe('./out');
  });

  it('parses --schema / -s', () => {
    expect(parseGlobalOptions(['--schema', './sch']).schema).toBe('./sch');
    expect(parseGlobalOptions(['-s', './sch']).schema).toBe('./sch');
  });

  it('parses --offline', () => {
    expect(parseGlobalOptions(['--offline']).offline).toBe(true);
  });

  it('parses --full', () => {
    expect(parseGlobalOptions(['--full']).full).toBe(true);
  });

  it('parses --verbose / -V', () => {
    expect(parseGlobalOptions(['--verbose']).verbose).toBe(true);
    expect(parseGlobalOptions(['-V']).verbose).toBe(true);
  });

  it('parses --version / -v', () => {
    expect(parseGlobalOptions(['--version', '1.0']).version).toBe('1.0');
    expect(parseGlobalOptions(['-v', '2.0']).version).toBe('2.0');
  });

  it('parses --snapshots with value', () => {
    const opts = parseGlobalOptions(['--snapshots', './my-snapshots']);
    expect(opts.snapshots).toBe('./my-snapshots');
  });

  it('parses combined options', () => {
    const opts = parseGlobalOptions(['--dry-run', '--force', '--to', '002']);
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
    expect(opts.to).toBe('002');
  });

  it('returns empty object for empty args', () => {
    expect(parseGlobalOptions([])).toEqual({});
  });

  it('ignores unknown flags', () => {
    const opts = parseGlobalOptions(['--unknown']);
    expect(opts).toEqual({});
  });

  it('handles multiple value options', () => {
    const opts = parseGlobalOptions([
      '--config',
      'config.ts',
      '--name',
      'my_migration',
      '--output',
      './migrations',
      '--schema',
      './schema',
      '--to',
      '003',
    ]);
    expect(opts.config).toBe('config.ts');
    expect(opts.name).toBe('my_migration');
    expect(opts.output).toBe('./migrations');
    expect(opts.schema).toBe('./schema');
    expect(opts.to).toBe('003');
  });

  it('handles dry-run before --config', () => {
    const opts = parseGlobalOptions(['--dry-run', '--config', 'cfg.ts']);
    expect(opts.dryRun).toBe(true);
    expect(opts.config).toBe('cfg.ts');
  });

  it('does not consume next arg as flag value for boolean flags', () => {
    // --dry-run is boolean, should not consume the next arg
    const opts = parseGlobalOptions(['--dry-run', '--force']);
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
  });
});
