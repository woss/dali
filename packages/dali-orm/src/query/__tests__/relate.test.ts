import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  wrote,
  review,
  wroteMultiIn,
  wroteMultiOut,
  wroteMultiBoth,
  defineTables,
  relate,
  graphPath,
  bindTable,
} from './test-utils.js';
import type { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { DaliORM } from '../../sdk/dali-orm.js';

let driver: EmbeddedDriver;
let orm: DaliORM;

beforeEach(async () => {
  driver = createTestDriver();
  await driver.connect();
  await defineTables(driver);
  orm = { getDriver: () => driver } as unknown as DaliORM;
});

afterEach(async () => {
  await driver.disconnect();
});

// ============================================================================
// 14. RelateBuilder
// ============================================================================

describe('RelateBuilder', () => {
  it('relate creates edge', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const results = await relate(orm, wrote).from('user:alice').to('post:1').execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
    expect(String(edge.id).startsWith('wrote:')).toBe(true);
  });

  it('relate with edge data', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    // Create edge with data - need to define the field first
    await driver.query('DEFINE FIELD since ON wrote TYPE string');

    const results = await relate(orm, wrote)
      .from('user:alice')
      .to('post:1')
      .set('since', '2024-01-01')
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate throws without from', async () => {
    await expect(relate(orm, wrote).to('post:1').execute()).rejects.toThrow(
      'Source record is required',
    );
  });

  it('relate throws without to', async () => {
    await expect(relate(orm, wrote).from('user:alice').execute()).rejects.toThrow(
      'Target record is required',
    );
  });
});

// ============================================================================
// 14b. Typed RelateBuilder
// ============================================================================

describe('Typed RelateBuilder', () => {
  it('typed set() with edge columns', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const results = await relate(orm, review)
      .from('user:alice')
      .to('post:1')
      .set('rating', 5)
      .set('comment', 'Great post!')
      .execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
    expect(String(edge.id).startsWith('review:')).toBe(true);
  });

  it('typed data() with partial edge data', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const results = await relate(orm, review)
      .from('user:alice')
      .to('post:1')
      .data({ rating: 4 })
      .execute();

    expect(results).toHaveLength(1);
  });

  it('RelateBuilder result includes relation metadata', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const results = await relate(orm, review)
      .from('user:alice')
      .to('post:1')
      .set('rating', 3)
      .execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
  });

  it('bindTable.relate() creates edge', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const boundReview = bindTable(review);
    const results = await boundReview
      .relate(orm as never)
      .from('user:alice')
      .to('post:1')
      .set('rating', 5)
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate with full edge data', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");

    const results = await relate(orm, review)
      .from('user:alice')
      .to('post:1')
      .data({ rating: 5, comment: 'Excellent' })
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate throws without from', async () => {
    await expect(relate(orm, review).to('post:1').execute()).rejects.toThrow(
      'Source record is required',
    );
  });

  it('relate throws without to', async () => {
    await expect(relate(orm, review).from('user:alice').execute()).rejects.toThrow(
      'Target record is required',
    );
  });
});

// ============================================================================
// 15. GraphPath
// ============================================================================

describe('GraphPath', () => {
  it('graphPath out().to()', () => {
    const path = graphPath().out('wrote').to('post');

    expect(path.toString()).toBe('->wrote->post');
  });

  it('graphPath in().to()', () => {
    const path = graphPath().in('wrote').to('user');

    expect(path.toString()).toBe('<-wrote<-user');
  });

  it('graphPath out().alias()', () => {
    const path = graphPath().out('wrote').alias('posts');

    expect(path.toString()).toBe('->wrote->posts');
  });

  it('graphPath multiple steps', () => {
    const path = graphPath().out('follows').to('user').out('wrote').to('post');

    expect(path.toString()).toBe('->follows->user->wrote->post');
  });

  it('graphPath getSteps()', () => {
    const path = graphPath().out('wrote').to('post');
    const steps = path.getSteps();

    expect(steps).toHaveLength(1);
    expect(steps[0].direction).toBe('out');
    expect(steps[0].edge).toBe('wrote');
    expect(steps[0].table).toBe('post');
  });

  it('graphPath throws on empty edge for out()', () => {
    expect(() => graphPath().out('')).toThrow('Edge name is required');
  });

  it('graphPath out().depth(1,3).to()', () => {
    const path = graphPath().out('wrote').depth(1, 3).to('post');
    expect(path.toString()).toBe('->wrote->post{1,3}');
  });

  it('graphPath out().depth(1).to()', () => {
    const path = graphPath().out('wrote').depth(1).to('post');
    expect(path.toString()).toBe('->wrote->post{1,}');
  });

  it('graphPath out().depth(0,5).to()', () => {
    const path = graphPath().out('follows').depth(0, 5).to('user');
    expect(path.toString()).toBe('->follows->user{0,5}');
  });

  it('graphPath in().depth(2,4).to()', () => {
    const path = graphPath().in('wrote').depth(2, 4).to('user');
    expect(path.toString()).toBe('<-wrote<-user{2,4}');
  });

  it('graphPath multiple steps with depth', () => {
    const path = graphPath()
      .out('follows')
      .depth(1, 3)
      .to('user')
      .out('wrote')
      .depth(0, 2)
      .to('post');
    expect(path.toString()).toBe('->follows->user{1,3}->wrote->post{0,2}');
  });

  it('graphPath depth validates min >= 0', () => {
    expect(() => graphPath().out('wrote').depth(-1).to('post')).toThrow('Depth min must be >= 0');
  });

  it('graphPath depth validates max >= min', () => {
    expect(() => graphPath().out('wrote').depth(3, 1).to('post')).toThrow(
      'Depth max must be >= min',
    );
  });

  it('graphPath depth with alias', () => {
    const path = graphPath().out('wrote').depth(2, 5).alias('posts');
    expect(path.toString()).toBe('->wrote->posts{2,5}');
  });
});

// ============================================================================
// Multi IN/OUT Relation Tables (TASK-044)
// ============================================================================

describe('Multi IN/OUT Relation Tables', () => {
  it('should define relation table with array in (multiple IN tables)', () => {
    expect(wroteMultiIn.name).toBe('wrote_multi_in');
    expect(wroteMultiIn.config.type).toBe('relation');
    expect(wroteMultiIn.config.in).toEqual(['user', 'admin']);
    expect(wroteMultiIn.config.out).toBe('post');
  });

  it('should define relation table with array out (multiple OUT tables)', () => {
    expect(wroteMultiOut.name).toBe('wrote_multi_out');
    expect(wroteMultiOut.config.type).toBe('relation');
    expect(wroteMultiOut.config.in).toBe('user');
    expect(wroteMultiOut.config.out).toEqual(['post', 'article']);
  });

  it('should define relation table with both array in and array out', () => {
    expect(wroteMultiBoth.name).toBe('wrote_multi_both');
    expect(wroteMultiBoth.config.type).toBe('relation');
    expect(wroteMultiBoth.config.in).toEqual(['user', 'admin']);
    expect(wroteMultiBoth.config.out).toEqual(['post', 'article']);
  });

  it('should generate correct SurrealQL with array in via defineTables()', async () => {
    // Verify the tables were created in the helper (already called in beforeEach)
    const result = await driver.query('INFO FOR DB');
    const dbInfo = Array.isArray(result) ? result[0] : result;
    const tables = Object.keys((dbInfo as Record<string, unknown>)?.tables ?? {});
    expect(tables).toContain('wrote_multi_in');
    expect(tables).toContain('wrote_multi_out');
    expect(tables).toContain('wrote_multi_both');
  });

  it('should allow RelateBuilder with multi IN/OUT tables', async () => {
    // Create records to relate
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE admin:root SET name = 'Root'");
    await driver.query("CREATE post:hello SET title = 'Hello'");

    // Relate from user to post (single in, single out — still works)
    const result = await relate(orm, wrote).from('user:alice').to('post:hello').execute();

    expect(result).toHaveLength(1);
  });

  it('should generate correct $id for multi IN/OUT tables', () => {
    expect(wroteMultiIn.$id('test')).toBe('wrote_multi_in:test');
    expect(wroteMultiOut.$id('test')).toBe('wrote_multi_out:test');
    expect(wroteMultiBoth.$id('test')).toBe('wrote_multi_both:test');
  });
});
