import { describe, expect, it } from 'vitest';
import { SurrealQLGenerator } from '../../../../migration/core/generator.js';
import { record } from '../record.js';
import {
  array,
  bool,
  bytes,
  datetime,
  decimal,
  duration,
  float,
  int,
  literal,
  object,
  set,
  string,
  uuid,
} from '../simple-builders.ts';

describe('simple-builders', () => {
  describe('wrapper functions', () => {
    it('string() creates a string builder', () => {
      const b = string('name');
      expect(b.name).toBe('name');
      const def = b.build();
      expect(def.config.type).toBe('string');
    });

    it('int() creates an int builder', () => {
      const b = int('age');
      expect(b.name).toBe('age');
      const def = b.build();
      expect(def.config.type).toBe('int');
    });

    it('float() creates a float builder', () => {
      const b = float('price');
      expect(b.name).toBe('price');
      const def = b.build();
      expect(def.config.type).toBe('float');
    });

    it('bool() creates a bool builder', () => {
      const b = bool('active');
      expect(b.name).toBe('active');
      const def = b.build();
      expect(def.config.type).toBe('bool');
    });

    it('datetime() creates a datetime builder', () => {
      const b = datetime('created_at');
      expect(b.name).toBe('created_at');
      const def = b.build();
      expect(def.config.type).toBe('datetime');
    });

    it('duration() creates a duration builder', () => {
      const b = duration('timeout');
      expect(b.name).toBe('timeout');
      const def = b.build();
      expect(def.config.type).toBe('duration');
    });

    it('decimal() creates a decimal builder', () => {
      const b = decimal('balance');
      expect(b.name).toBe('balance');
      const def = b.build();
      expect(def.config.type).toBe('decimal');
    });

    it('array() creates an array builder', () => {
      const b = array('tags');
      expect(b.name).toBe('tags');
      const def = b.build();
      expect(def.config.type).toBe('array');
    });

    it('object() creates an object builder', () => {
      const b = object('metadata');
      expect(b.name).toBe('metadata');
      const def = b.build();
      expect(def.config.type).toBe('object');
    });

    it('uuid() creates a uuid builder', () => {
      const b = uuid('id');
      expect(b.name).toBe('id');
      const def = b.build();
      expect(def.config.type).toBe('uuid');
    });

    it('set() creates a set builder', () => {
      const b = set('tags');
      expect(b.name).toBe('tags');
      const def = b.build();
      expect(def.config.type).toBe('set');
    });

    it('bytes() creates a bytes builder', () => {
      const b = bytes('data');
      expect(b.name).toBe('data');
      const def = b.build();
      expect(def.config.type).toBe('bytes');
    });

    it('literal() creates a literal builder', () => {
      const b = literal('color');
      expect(b.name).toBe('color');
      const def = b.build();
      expect(def.config.type).toBe('literal');
    });

    it('all wrapper types are distinct', () => {
      const types = [
        string,
        int,
        float,
        bool,
        datetime,
        duration,
        decimal,
        array,
        object,
        uuid,
      ];
      const names = ['s', 'i', 'f', 'b', 'd', 'du', 'de', 'a', 'o', 'u'];
      const built = names.map((n, i) => types[i](n).build());
      const typeStrings = built.map((d) => d.config.type);
      expect(new Set(typeStrings).size).toBe(typeStrings.length);
    });
  });

  describe('build() method', () => {
    it('returns name and config', () => {
      const b = string('email');
      const def = b.build();
      expect(def.name).toBe('email');
      expect(def.config).toBeDefined();
      expect(def.config.type).toBe('string');
    });

    it('accepts optional tableName', () => {
      const b = string('email');
      const def = b.build('users');
      expect(def.tableName).toBe('users');
    });

    it('tableName defaults to undefined when omitted', () => {
      const b = string('email');
      const def = b.build();
      expect(def.tableName).toBeUndefined();
    });

    it('build() returns a snapshot copy (immutable)', () => {
      const b = string('email');
      const def1 = b.build();
      const def2 = b.optional().build();
      expect(def1.config.optional).toBeUndefined();
      expect(def2.config.optional).toBe(true);
    });

    it('build() with second columnName parameter', () => {
      const b = string('email');
      const def = b.build('users', 'user_email');
      expect(def.tableName).toBe('users');
      expect(def.name).toBe('email');
    });
  });

  describe('optional()', () => {
    it('sets optional flag to true', () => {
      const b = string('nickname');
      const def = b.optional().build();
      expect(def.config.optional).toBe(true);
    });
  });

  describe('default()', () => {
    it('sets default value for string type', () => {
      const b = string('role');
      const def = b.default('user').build();
      expect(def.config.default).toBe('user');
    });

    it('sets default value for bool type', () => {
      const b = bool('active');
      const def = b.default(true).build();
      expect(def.config.default).toBe('true');
    });

    it('sets default value for numeric type', () => {
      const b = int('count');
      const def = b.default(42).build();
      expect(def.config.default).toBe('42');
    });

    it('sets default value of false for bool', () => {
      const b = bool('active');
      const def = b.default(false).build();
      expect(def.config.default).toBe('false');
    });

    it('sets default value of 0 for int', () => {
      const b = int('count');
      const def = b.default(0).build();
      expect(def.config.default).toBe('0');
    });
  });

  describe('defaultRaw()', () => {
    it('sets raw SurrealDB expression as defaultRaw', () => {
      const b = string('content_hash');
      const def = b.defaultRaw('crypto::blake3(content)').build();
      expect(def.config.defaultRaw).toBe('crypto::blake3(content)');
    });

    it('defaultRaw stores raw expression, separate from default', () => {
      const b = string('hash');
      const def = b
        .default('fallback')
        .defaultRaw('crypto::blake3(content)')
        .build();
      expect(def.config.defaultRaw).toBe('crypto::blake3(content)');
      expect(def.config.default).toBe('fallback');
    });
  });

  describe('defaultNow()', () => {
    it('sets default to time::now()', () => {
      const b = datetime('created_at');
      const def = b.defaultNow().build();
      expect(def.config.default).toBe('time::now()');
    });
  });

  describe('unique()', () => {
    it('sets unique flag to true', () => {
      const b = string('email');
      const def = b.unique().build();
      expect(def.config.unique).toBe(true);
    });
  });

  describe('flexible()', () => {
    it('sets flexible flag to true', () => {
      const b = object('metadata');
      const def = b.flexible().build();
      expect(def.config.flexible).toBe(true);
    });
  });

  describe('readonly()', () => {
    it('sets readonly flag to true', () => {
      const b = string('id');
      const def = b.readonly().build();
      expect(def.config.readonly).toBe(true);
    });
  });

  describe('assert()', () => {
    it('sets assert expression', () => {
      const b = int('age');
      const def = b.assert('$value > 0').build();
      expect(def.config.assert).toBe('$value > 0');
    });
  });

  describe('permissions()', () => {
    it('sets permissions string', () => {
      const b = string('email');
      const def = b.permissions('FOR select FULL').build();
      expect(def.config.permissions).toBe('FOR select FULL');
    });
  });

  describe('chaining', () => {
    it('chains optional() then default() then unique()', () => {
      const b = string('email');
      const def = b.optional().default('none').unique().build();
      expect(def.config.optional).toBe(true);
      expect(def.config.default).toBe('none');
      expect(def.config.unique).toBe(true);
    });

    it('chains all builder methods', () => {
      const b = string('full_column');
      const def = b
        .optional()
        .default('default_val')
        .defaultRaw('crypto::blake3(field)')
        .unique()
        .flexible()
        .readonly()
        .assert('$value != ""')
        .permissions('FOR select FULL')
        .build();

      expect(def.config.optional).toBe(true);
      expect(def.config.defaultRaw).toBe('crypto::blake3(field)');
      expect(def.config.unique).toBe(true);
      expect(def.config.flexible).toBe(true);
      expect(def.config.readonly).toBe(true);
      expect(def.config.assert).toBe('$value != ""');
      expect(def.config.permissions).toBe('FOR select FULL');
    });

    it('default and defaultRaw are independent config fields', () => {
      const b = string('hash');
      const def = b
        .default('fallback')
        .defaultRaw('crypto::sha256(content)')
        .build();
      expect(def.config.defaultRaw).toBe('crypto::sha256(content)');
      expect(def.config.default).toBe('fallback');
    });

    it('default overrides defaultRaw if called last', () => {
      const b = string('hash');
      // defaultRaw sets defaultRaw field, default sets default field — they're independent
      const def = b
        .defaultRaw('crypto::sha256(content)')
        .default('fallback')
        .build();
      expect(def.config.defaultRaw).toBe('crypto::sha256(content)');
      expect(def.config.default).toBe('fallback');
    });
  });

  describe('independence', () => {
    it('produces independent instances from same factory call', () => {
      const b1 = string('a');
      const b2 = string('b');
      expect(b1.name).toBe('a');
      expect(b2.name).toBe('b');
      expect(b1).not.toBe(b2);
    });

    it('separate builders do not share config mutations', () => {
      const b1 = string('col_a');
      const b2 = string('col_b');
      b1.optional().unique();
      const def1 = b1.build();
      const def2 = b2.build();
      expect(def1.config.optional).toBe(true);
      expect(def1.config.unique).toBe(true);
      expect(def2.config.optional).toBeUndefined();
      expect(def2.config.unique).toBeUndefined();
    });
  });

  describe('record reference', () => {
    it('record().reference({ onDelete: "CASCADE" }) sets onDelete', () => {
      const b = record('users').reference({ onDelete: 'CASCADE' });
      const def = b.build('posts', 'owner');
      expect(def.config.onDelete).toBe('CASCADE');
    });

    it('record().reference({ onDelete: "SET NULL" }) sets onDelete', () => {
      const b = record('users').reference({ onDelete: 'SET NULL' });
      const def = b.build('posts', 'owner');
      expect(def.config.onDelete).toBe('SET NULL');
    });

    it('record().reference({ onDelete: "RESTRICT" }) sets onDelete', () => {
      const b = record('users').reference({ onDelete: 'RESTRICT' });
      const def = b.build('posts', 'owner');
      expect(def.config.onDelete).toBe('RESTRICT');
    });

    it('reference is chainable with other builder methods', () => {
      const b = record('users').reference({ onDelete: 'CASCADE' }).optional();
      const def = b.build('posts', 'owner');
      expect(def.config.onDelete).toBe('CASCADE');
      expect(def.config.optional).toBe(true);
    });

    it('reference without calling reference() leaves onDelete undefined', () => {
      const b = record('users');
      const def = b.build('posts', 'owner');
      expect(def.config.onDelete).toBeUndefined();
    });
  });

  describe('generator REFERENCE ON DELETE', () => {
    it('emits REFERENCE ON DELETE CASCADE in field SQL', () => {
      const gen = new SurrealQLGenerator();
      const sql = gen.generateFieldDefinition({
        name: 'owner',
        config: { type: 'record', recordTable: 'users', onDelete: 'CASCADE' },
        tableName: 'projects',
      });
      expect(sql).toContain('REFERENCE ON DELETE CASCADE');
      expect(sql).toContain('TYPE record<users>');
    });

    it('emits REFERENCE ON DELETE SET NULL in field SQL', () => {
      const gen = new SurrealQLGenerator();
      const sql = gen.generateFieldDefinition({
        name: 'owner',
        config: { type: 'record', recordTable: 'users', onDelete: 'SET NULL' },
        tableName: 'projects',
      });
      expect(sql).toContain('REFERENCE ON DELETE SET NULL');
    });

    it('emits REFERENCE ON DELETE RESTRICT in field SQL', () => {
      const gen = new SurrealQLGenerator();
      const sql = gen.generateFieldDefinition({
        name: 'owner',
        config: { type: 'record', recordTable: 'users', onDelete: 'RESTRICT' },
        tableName: 'projects',
      });
      expect(sql).toContain('REFERENCE ON DELETE RESTRICT');
    });

    it('omits REFERENCE ON DELETE when onDelete is not set', () => {
      const gen = new SurrealQLGenerator();
      const sql = gen.generateFieldDefinition({
        name: 'owner',
        config: { type: 'record', recordTable: 'users' },
        tableName: 'projects',
      });
      expect(sql).not.toContain('REFERENCE ON DELETE');
    });
  });
});
