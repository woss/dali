/**
 * Integration tests for SurrealQLGenerator HNSW index SQL
 *
 * Validates generated HNSW index definitions against a live embedded SurrealDB
 * engine. Catches syntax errors that pure string-matching tests cannot detect.
 *
 * Each test creates a unique table, defines a vector field, generates HNSW index
 * SQL via SurrealQLGenerator, executes it against the engine, then cleans up.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import { SurrealQLGenerator } from '../generator.js';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// Helpers
// ============================================================================

const NS = 'generator_int';
const DB = `test_${Date.now()}`;

let _counter = 0;
function uniqueTable(prefix = 'hnsw'): string {
  _counter++;
  return `${prefix}_${_counter}_${Date.now()}`;
}

// ============================================================================
// Setup
// ============================================================================

let driver: EmbeddedDriver;
let gen: SurrealQLGenerator;

beforeAll(async () => {
  // Try file-backed mode first (surrealkv) — HNSW may need it
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'generator-int-'));
  try {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: NS,
      database: DB,
      mode: 'surrealkv',
      path: tmpDir,
    });
    await driver.connect();
  } catch {
    // Fall back to memory mode — if HNSW fails here, tests will fail explicitly (no silent skip)
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: NS,
      database: DB,
      mode: 'memory',
    });
    await driver.connect();
  }
  gen = new SurrealQLGenerator();
});

afterAll(async () => {
  await driver.disconnect();
});

// ============================================================================
// Tests
// ============================================================================

describe('SurrealQLGenerator HNSW (integration)', () => {
  it('validates HNSW COSINE with float32 against engine', async () => {
    const tn = uniqueTable('hnsw_cos');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD vec ON TABLE ${tn} TYPE float`);

    const sql = gen.generateIndexDefinition(
      {
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw' as const,
        dimension: 128,
        vectorType: 'float32' as const,
        distance: 'COSINE' as const,
      },
      tn,
    );

    // Expected SQL: HNSW DIMENSION 128 TYPE F32 DIST COSINE
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates HNSW with minimal params (dimension only)', async () => {
    const tn = uniqueTable('hnsw_min');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD vec ON TABLE ${tn} TYPE float`);

    const sql = gen.generateIndexDefinition(
      {
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw' as const,
        dimension: 64,
      },
      tn,
    );

    // Expected SQL: HNSW DIMENSION 64
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates HNSW with MANHATTAN distance + float64', async () => {
    const tn = uniqueTable('hnsw_man');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD vec ON TABLE ${tn} TYPE float`);

    const sql = gen.generateIndexDefinition(
      {
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw' as const,
        dimension: 256,
        vectorType: 'float64' as const,
        distance: 'MANHATTAN' as const,
      },
      tn,
    );

    // Expected SQL: DIMENSION 256 TYPE F64 DIST MANHATTAN
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates HNSW with EUCLIDEAN distance (no vectorType)', async () => {
    const tn = uniqueTable('hnsw_euc');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD vec ON TABLE ${tn} TYPE float`);

    const sql = gen.generateIndexDefinition(
      {
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw' as const,
        dimension: 64,
        distance: 'EUCLIDEAN' as const,
      },
      tn,
    );

    // Expected SQL: DIMENSION 64 DIST EUCLIDEAN
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates HNSW with float (deprecated alias, no distance)', async () => {
    const tn = uniqueTable('hnsw_flt');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD vec ON TABLE ${tn} TYPE float`);

    const sql = gen.generateIndexDefinition(
      {
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw' as const,
        dimension: 128,
        vectorType: 'float' as const,
        distance: 'COSINE' as const,
      },
      tn,
    );

    // Expected SQL: TYPE F64 DIST COSINE
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 1. Table definitions
// ============================================================================

describe('generateTableDefinition (integration)', () => {
  it('validates SCHEMAFULL table', async () => {
    const tn = uniqueTable('tbl_sf');
    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: { schema: 'full' },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates SCHEMALESS table', async () => {
    const tn = uniqueTable('tbl_sl');
    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: { schema: 'less' },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates TYPE RELATION with IN/OUT', async () => {
    const refUser = uniqueTable('tbl_user');
    const refPost = uniqueTable('tbl_post');
    const tn = uniqueTable('tbl_rel');
    // Create referenced tables first
    await driver.query(`DEFINE TABLE ${refUser} SCHEMAFULL`);
    await driver.query(`DEFINE TABLE ${refPost} SCHEMAFULL`);

    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: { type: 'relation', in: refUser, out: refPost },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
    await driver.query(`REMOVE TABLE ${refUser}`);
    await driver.query(`REMOVE TABLE ${refPost}`);
  });

  it('validates PERMISSIONS on table', async () => {
    const tn = uniqueTable('tbl_perm');
    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: {
        permissions: {
          select: 'WHERE published = true',
          create: 'WHERE $auth.role = "admin"',
        },
      },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates CHANGEFEED on table', async () => {
    const tn = uniqueTable('tbl_cf');
    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: { changefeed: '7d' },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates combined options on table', async () => {
    const tn = uniqueTable('tbl_comb');
    const sql = gen.generateTableDefinition({
      name: tn,
      columns: [],
      config: {
        schema: 'less',
        permissions: {
          select: 'FULL',
          create: 'NONE',
          update: 'NONE',
          delete: 'NONE',
        },
        changefeed: '24h',
      },
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 2. Field definitions
// ============================================================================

describe('generateFieldDefinition (integration)', () => {
  it('validates basic string field', async () => {
    const tn = uniqueTable('fd_str');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateFieldDefinition({
      name: 'username',
      config: { type: 'string' },
      tableName: tn,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates optional<string> field', async () => {
    const tn = uniqueTable('fd_opt');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateFieldDefinition({
      name: 'nickname',
      config: { type: 'string', optional: true },
      tableName: tn,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates record<refTable> field', async () => {
    const refUser = uniqueTable('fd_ref_user');
    const tn = uniqueTable('fd_ref');
    await driver.query(`DEFINE TABLE ${refUser} SCHEMAFULL`);
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateFieldDefinition({
      name: 'author',
      config: { type: 'record', linksTo: refUser },
      tableName: tn,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
    await driver.query(`REMOVE TABLE ${refUser}`);
  });

  it('validates FLEXIBLE + READONLY + DEFAULT + ASSERT + PERMISSIONS', async () => {
    const tn = uniqueTable('fd_all');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateFieldDefinition({
      name: 'payload',
      config: {
        type: 'object',
        flexible: true,
        readonly: true,
        default: '{}',
        assert: '$value != none',
        permissions: 'FOR select WHERE $auth.role = "admin"',
      },
      tableName: tn,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates tuple field definition', async () => {
    const tn = uniqueTable('fd_tup');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateFieldDefinition({
      name: 'coords',
      config: {
        type: 'tuple',
        size: 2,
        elements: [{ type: 'float' }, { type: 'float' }],
      },
      tableName: tn,
    });
    // Tuple returns multiple statements joined by '; '
    const statements = sql.split('; ').filter((s) => s.trim());
    for (const stmt of statements) {
      await expect(driver.query(stmt)).resolves.toBeDefined();
    }

    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 3. Field redefine
// ============================================================================

describe('generateFieldRedefine (integration)', () => {
  it('validates field redefine overwrites existing field', async () => {
    const tn = uniqueTable('fred');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD name ON TABLE ${tn} TYPE string`);

    const sql = gen.generateFieldRedefine({
      name: 'name',
      config: { type: 'string' },
      tableName: tn,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 4. Index non-HNSW
// ============================================================================

describe('generateIndexDefinition non-HNSW (integration)', () => {
  it('validates basic index (no type)', async () => {
    const tn = uniqueTable('idx_basic');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD email ON TABLE ${tn} TYPE string`);

    const sql = gen.generateIndexDefinition({ name: 'idx_email', fields: ['email'] }, tn);
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates UNIQUE index', async () => {
    const tn = uniqueTable('idx_unq');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD email ON TABLE ${tn} TYPE string`);

    const sql = gen.generateIndexDefinition(
      { name: 'idx_email', fields: ['email'], type: 'unique' },
      tn,
    );
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates FULLTEXT index with analyzer', async () => {
    const tn = uniqueTable('idx_ft');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD body ON TABLE ${tn} TYPE string`);

    const sql = gen.generateIndexDefinition(
      { name: 'idx_body', fields: ['body'], type: 'fulltext', analyzer: 'keyword' },
      tn,
    );
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates composite index', async () => {
    const tn = uniqueTable('idx_comp');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD first_name ON TABLE ${tn} TYPE string`);
    await driver.query(`DEFINE FIELD last_name ON TABLE ${tn} TYPE string`);

    const sql = gen.generateIndexDefinition(
      { name: 'idx_name', fields: ['first_name', 'last_name'] },
      tn,
    );
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 5. Access definitions
// ============================================================================

describe('generateAccessDefinition (integration)', () => {
  it('validates RECORD access with signup/signin', async () => {
    const userTbl = uniqueTable('acc_user');
    await driver.query(`DEFINE TABLE ${userTbl} SCHEMAFULL`);

    const sql = gen.generateAccessDefinition({
      name: 'test_record_access',
      type: 'RECORD',
      signup: `CREATE ${userTbl} SET email = $email, pass = crypto::argon2::generate($pass)`,
      signin: `SELECT * FROM ${userTbl} WHERE email = $email AND crypto::argon2::compare(pass, $pass)`,
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query('REMOVE ACCESS IF EXISTS test_record_access ON DATABASE');
    await driver.query(`REMOVE TABLE ${userTbl}`);
  });

  it('validates JWT access with ALGORITHM and KEY', async () => {
    const sql = gen.generateAccessDefinition({
      name: 'test_jwt_access',
      type: 'JWT',
      algorithm: 'RS256',
      key: 'mysecret',
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query('REMOVE ACCESS IF EXISTS test_jwt_access ON DATABASE');
  });
});

// ============================================================================
// 6. Events
// ============================================================================

describe('generateEventDefinition (integration)', () => {
  it('validates basic event with WHEN and THEN', async () => {
    const tn = uniqueTable('evt_main');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateEventDefinition({
      name: 'on_create',
      what: tn,
      when: '$event = "CREATE"',
      then: ['INSERT INTO audit SET action = "created"'],
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    // Cleanup: remove event then table
    await driver.query(`REMOVE EVENT IF EXISTS on_create ON TABLE ${tn}`);
    await driver.query(`REMOVE TABLE ${tn}`);
  });
});

// ============================================================================
// 7. Functions
// ============================================================================

describe('generateFunctionDefinition (integration)', () => {
  it('validates basic function with args', async () => {
    const fnName = uniqueTable('fn_greet').replace(/-/g, '_');
    const qualified = `fn::${fnName}`;

    const sql = gen.generateFunctionDefinition({
      name: qualified,
      args: ['$name: string'],
      body: 'RETURN "Hello " + $name',
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE FUNCTION IF EXISTS ${qualified}`);
  });
});

// ============================================================================
// 8. Analyzer definitions
// ============================================================================

describe('generateAnalyzerDefinition (integration)', () => {
  it('validates DEFINE ANALYZER with tokenizers and filters', async () => {
    const sql = gen.generateAnalyzerDefinition({
      name: 'test_analyzer_int',
      tokenizers: ['class'],
      filters: ['ascii', 'lowercase'],
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query('REMOVE ANALYZER IF EXISTS test_analyzer_int');
  });

  it('validates DEFINE ANALYZER with only tokenizers', async () => {
    const sql = gen.generateAnalyzerDefinition({
      name: 'test_analyzer_tok',
      tokenizers: 'class',
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query('REMOVE ANALYZER IF EXISTS test_analyzer_tok');
  });

  it('validates DEFINE ANALYZER with single string tokenizers and filters', async () => {
    const sql = gen.generateAnalyzerDefinition({
      name: 'test_analyzer_str',
      tokenizers: 'class',
      filters: 'lowercase',
    });
    await expect(driver.query(sql)).resolves.toBeDefined();
    await driver.query('REMOVE ANALYZER IF EXISTS test_analyzer_str');
  });

  it('validates REMOVE ANALYZER IF EXISTS for non-existent analyzer', async () => {
    await expect(
      driver.query('REMOVE ANALYZER IF EXISTS nonexistent_analyzer'),
    ).resolves.toBeDefined();
  });
});

// ============================================================================
// 9. Alter operations
// ============================================================================

describe('Alter operations (integration)', () => {
  it('validates ALTER FIELD TYPE', async () => {
    const tn = uniqueTable('alt_type');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD label ON TABLE ${tn} TYPE string`);

    const sql = gen.generateAlterFieldType(tn, 'label', 'int');
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates ALTER TABLE PERMISSIONS', async () => {
    const tn = uniqueTable('alt_perm');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);

    const sql = gen.generateAlterTablePermissions(tn, {
      select: 'FULL',
      create: 'NONE',
      update: 'NONE',
      delete: 'NONE',
    });
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });

  it('validates ALTER FIELD DEFAULT', async () => {
    const tn = uniqueTable('alt_def');
    await driver.query(`DEFINE TABLE ${tn} SCHEMAFULL`);
    await driver.query(`DEFINE FIELD role ON TABLE ${tn} TYPE string`);

    const sql = gen.generateAlterFieldDefault(tn, 'role', 'viewer');
    await expect(driver.query(sql)).resolves.toBeDefined();

    await driver.query(`REMOVE TABLE ${tn}`);
  });
});
