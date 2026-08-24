import { describe, expect, it } from 'vitest';
import { datetime, string } from '../../sdk/schema/column/simple-builders.js';
import { defineTable } from '../../sdk/table.js';
import { SchemaDiffer } from '../core/diff.js';
import { SurrealQLGenerator } from '../core/generator.js';

const generator = new SurrealQLGenerator();
const differ = new SchemaDiffer();

describe('index definition SQL generation', () => {
  it('generates DEFINE INDEX SQL for unique index', () => {
    const sql = generator.generateIndexDefinition(
      {
        name: 'idx_users_email',
        fields: ['email'],
        type: 'unique',
      },
      'users',
    );
    expect(sql).toBe('DEFINE INDEX idx_users_email ON TABLE users COLUMNS email UNIQUE');
  });

  it('generates DEFINE INDEX SQL for unique index with multiple fields', () => {
    const sql = generator.generateIndexDefinition(
      {
        name: 'idx_users_name_age',
        fields: ['name', 'age'],
        type: 'unique',
      },
      'users',
    );
    expect(sql).toBe('DEFINE INDEX idx_users_name_age ON TABLE users COLUMNS name, age UNIQUE');
  });

  it('throws error for empty index name', () => {
    expect(() =>
      generator.generateIndexDefinition({ name: '', fields: ['email'], type: 'unique' }, 'users'),
    ).toThrow('Index name is required');
  });

  it('throws error for empty fields', () => {
    expect(() =>
      generator.generateIndexDefinition({ name: 'idx_test', fields: [], type: 'unique' }, 'users'),
    ).toThrow('must have at least one field');
  });

  it('throws error for missing table name', () => {
    expect(() =>
      generator.generateIndexDefinition(
        { name: 'idx_test', fields: ['email'], type: 'unique' },
        '',
      ),
    ).toThrow('Table name is required');
  });
});

describe('SchemaDiffer index detection', () => {
  it('detects added unique index on existing table', () => {
    const oldSchema = [
      defineTable('users', {
        email: string('email'),
        name: string('name'),
      }),
    ];

    const newSchema = [
      defineTable(
        'users',
        { email: string('email'), name: string('name') },
        {
          indexes: [{ name: 'idx_users_email', fields: ['email'], type: 'unique' }],
        },
      ),
    ];

    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.indexes).toHaveLength(1);
    expect(result.added.indexes[0]).toEqual({
      table: 'users',
      index: { name: 'idx_users_email', fields: ['email'], type: 'unique' },
    });
  });

  it('detects no index changes when schemas are identical', () => {
    const schema = [
      defineTable(
        'users',
        { email: string('email'), name: string('name') },
        {
          indexes: [{ name: 'idx_users_email', fields: ['email'], type: 'unique' }],
        },
      ),
    ];

    const result = differ.diff(schema, schema);
    expect(result.added.indexes).toHaveLength(0);
    expect(result.removed.indexes).toHaveLength(0);
  });

  it('detects removed index', () => {
    const oldSchema = [
      defineTable(
        'users',
        { email: string('email'), name: string('name') },
        {
          indexes: [{ name: 'idx_users_email', fields: ['email'], type: 'unique' }],
        },
      ),
    ];

    const newSchema = [
      defineTable('users', {
        email: string('email'),
        name: string('name'),
      }),
    ];

    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.indexes).toHaveLength(1);
    expect(result.removed.indexes[0]).toEqual({
      table: 'users',
      name: 'idx_users_email',
    });
  });

  it('detects added unique index only on specific table', () => {
    const oldSchema = [
      defineTable('users', { email: string('email') }),
      defineTable('posts', { title: string('title') }),
    ];

    const newSchema = [
      defineTable('users', { email: string('email') }),
      defineTable(
        'posts',
        { title: string('title') },
        {
          indexes: [{ name: 'idx_posts_title', fields: ['title'], type: 'unique' }],
        },
      ),
    ];

    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.indexes).toHaveLength(1);
    expect(result.added.indexes[0]).toEqual({
      table: 'posts',
      index: { name: 'idx_posts_title', fields: ['title'], type: 'unique' },
    });
  });
});

describe('index migration integration', () => {
  it('generates CREATE INDEX in up migration for added index', () => {
    const table = defineTable(
      'projects',
      {
        created_at: datetime('created_at').defaultNow(),
        directory_path: string('directory_path'),
        name: string('name'),
      },
      {
        indexes: [
          {
            name: 'idx_projects_directory_path',
            fields: ['directory_path'],
            type: 'unique',
          },
        ],
      },
    );

    const sqlStatements = generator.generateTableMigration(table);
    const indexStatements = sqlStatements.filter((s) => s.startsWith('DEFINE INDEX'));
    expect(indexStatements).toHaveLength(1);
    expect(indexStatements[0]).toBe(
      'DEFINE INDEX idx_projects_directory_path ON TABLE projects COLUMNS directory_path UNIQUE',
    );
  });

  it('generateTableMigration includes DEFINE TABLE, fields, and indexes in correct order', () => {
    const table = defineTable(
      'projects',
      {
        created_at: datetime('created_at').defaultNow(),
        directory_path: string('directory_path'),
      },
      {
        indexes: [
          {
            name: 'idx_projects_directory_path',
            fields: ['directory_path'],
            type: 'unique',
          },
        ],
      },
    );

    const sqlStatements = generator.generateTableMigration(table);

    // Order should be: DEFINE TABLE, DEFINE FIELD, DEFINE INDEX
    expect(sqlStatements[0]).toContain('DEFINE TABLE');
    sqlStatements.slice(1).forEach((s) => {
      if (s.startsWith('DEFINE FIELD')) {
        // All DEFINE FIELD statements should come before DEFINE INDEX
        const fieldIdx = sqlStatements.indexOf(s);
        const indexStmts = sqlStatements
          .map((stmt, idx) => ({ stmt, idx }))
          .filter(({ stmt }) => stmt.startsWith('DEFINE INDEX'));
        for (const { idx: indexIdx } of indexStmts) {
          expect(fieldIdx).toBeLessThan(indexIdx);
        }
      }
    });
  });
});
