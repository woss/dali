import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  createTestDriver,
  defineTables,
  select,
  graphPath,
  users,
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
// Adversarial Tests for Graph Depth Enhancement
// ============================================================================

describe('Adversarial: GraphPath.depth() validation', () => {
  it('depth(-1) throws error', () => {
    expect(() => graphPath().out('wrote').depth(-1).to('post')).toThrow('Depth min must be >= 0');
  });

  it('depth(-100) throws error', () => {
    expect(() => graphPath().out('wrote').depth(-100).to('post')).toThrow('Depth min must be >= 0');
  });

  it('depth(3, 1) throws error (max < min)', () => {
    expect(() => graphPath().out('wrote').depth(3, 1).to('post')).toThrow(
      'Depth max must be >= min',
    );
  });

  it('depth(5, 0) throws error (max < min)', () => {
    expect(() => graphPath().out('wrote').depth(5, 0).to('post')).toThrow(
      'Depth max must be >= min',
    );
  });

  it('depth(100, 1) throws error (large gap, max < min)', () => {
    expect(() => graphPath().out('wrote').depth(100, 1).to('post')).toThrow(
      'Depth max must be >= min',
    );
  });
});

describe('Adversarial: GraphPath.depth() edge values', () => {
  it('depth(0, 0) works — zero-depth range', () => {
    const path = graphPath().out('wrote').depth(0, 0).to('post');
    expect(path.toString()).toBe('->wrote->post{0,0}');
  });

  it('depth(0) works — unbounded from zero', () => {
    const path = graphPath().out('wrote').depth(0).to('post');
    expect(path.toString()).toBe('->wrote->post{0,}');
  });

  it('depth(0) with alias works', () => {
    const path = graphPath().out('wrote').depth(0).alias('posts');
    expect(path.toString()).toBe('->wrote->posts{0,}');
  });

  it('depth(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) works (extreme value, same min/max)', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const path = graphPath().out('wrote').depth(max, max).to('post');
    expect(path.toString()).toBe(`->wrote->post{${max},${max}}`);
  });
});

describe('Adversarial: GraphPath.depth() on alias', () => {
  it('depth(1, 3) on alias renders correctly', () => {
    const path = graphPath().out('wrote').depth(1, 3).alias('posts');
    expect(path.toString()).toBe('->wrote->posts{1,3}');
  });

  it('depth(2) on alias renders unbounded', () => {
    const path = graphPath().in('authored').depth(2).alias('articles');
    expect(path.toString()).toBe('<-authored<-articles{2,}');
  });

  it('depth(0, 1) on alias renders correctly', () => {
    const path = graphPath().out('follows').depth(0, 1).alias('friends');
    expect(path.toString()).toBe('->follows->friends{0,1}');
  });
});

describe('Adversarial: Multiple traversals with different depths', () => {
  it('two steps with different bounded depth ranges', () => {
    const path = graphPath()
      .out('follows')
      .depth(1, 2)
      .to('user')
      .out('wrote')
      .depth(3, 5)
      .to('post');
    expect(path.toString()).toBe('->follows->user{1,2}->wrote->post{3,5}');
  });

  it('one bounded, one unbounded depth', () => {
    const path = graphPath().out('follows').depth(1, 3).to('user').out('wrote').depth(0).to('post');
    expect(path.toString()).toBe('->follows->user{1,3}->wrote->post{0,}');
  });

  it('three steps each with different depth', () => {
    const path = graphPath()
      .out('follows')
      .depth(0, 1)
      .to('user')
      .out('wrote')
      .depth(2, 4)
      .to('post')
      .in('reviewed_by')
      .depth(1)
      .alias('reviewer');
    expect(path.toString()).toBe(
      '->follows->user{0,1}->wrote->post{2,4}<-reviewed_by<-reviewer{1,}',
    );
  });

  it('step without depth followed by step with depth', () => {
    const path = graphPath().out('wrote').to('post').out('tagged').depth(1, 2).to('tag');
    expect(path.toString()).toBe('->wrote->post->tagged->tag{1,2}');
  });

  it('step with depth followed by step without depth', () => {
    const path = graphPath().out('wrote').depth(2, 3).to('post').out('tagged').to('tag');
    expect(path.toString()).toBe('->wrote->post{2,3}->tagged->tag');
  });
});

describe('Adversarial: SelectBuilder traverse() with depth', () => {
  it('traverse with depth(0,0) generates correct SQL', () => {
    const result = select(orm, users)
      .traverse('out', 'wrote', 'post', 'posts', { depth: { min: 0, max: 0 } })
      .toSQL();
    expect(result.sql).toContain('->wrote->post{0,0}.* AS posts');
  });

  it('traverse with large depth range generates correct SQL', () => {
    const result = select(orm, users)
      .traverse('out', 'wrote', 'post', 'posts', { depth: { min: 1, max: 100 } })
      .toSQL();
    expect(result.sql).toContain('->wrote->post{1,100}.* AS posts');
  });

  it('multiple traversals with different depth ranges', () => {
    const result = select(orm, users)
      .traverse('out', 'wrote', 'post', 'posts', { depth: { min: 1, max: 3 } })
      .traverse('in', 'followed_by', 'user', 'followers', { depth: { min: 0, max: 2 } })
      .toSQL();
    expect(result.sql).toContain('->wrote->post{1,3}.* AS posts');
    expect(result.sql).toContain('<-followed_by<-user{0,2}.* AS followers');
  });

  it('traverse with depth and WHERE clause', () => {
    const result = select(orm, users)
      .where((w) => w.gt('age', 20))
      .traverse('out', 'wrote', 'post', 'posts', { depth: { min: 1, max: 5 } })
      .toSQL();
    expect(result.sql).toContain('->wrote->post{1,5}.* AS posts');
    expect(result.sql).toContain('WHERE');
    expect(result.sql).toContain('age > $p0');
    expect(result.params.p0).toBe(20);
  });

  it('traverse with depth and ORDER BY + LIMIT', () => {
    const result = select(orm, users)
      .traverse('out', 'wrote', 'post', 'posts', { depth: { min: 1, max: 3 } })
      .orderBy('name', 'ASC')
      .limit(10)
      .toSQL();
    expect(result.sql).toContain('->wrote->post{1,3}.* AS posts');
    expect(result.sql).toContain('ORDER BY name ASC');
    expect(result.sql).toContain('LIMIT 10');
  });

  it('inbound traverse with unbounded depth', () => {
    const result = select(orm, users)
      .traverse('in', 'authored', 'posts', { depth: { min: 1 } })
      .toSQL();
    expect(result.sql).toContain('<-authored<-posts{1,}.* AS posts');
  });
});

describe('Adversarial: getSteps() integrity with depth', () => {
  it('getSteps() includes depth for bounded step', () => {
    const path = graphPath().out('wrote').depth(1, 3).to('post');
    const steps = path.getSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].depth).toEqual({ min: 1, max: 3 });
  });

  it('getSteps() includes depth for unbounded step', () => {
    const path = graphPath().out('wrote').depth(2).to('post');
    const steps = path.getSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].depth).toEqual({ min: 2 });
  });

  it('getSteps() has no depth when depth() not called', () => {
    const path = graphPath().out('wrote').to('post');
    const steps = path.getSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].depth).toBeUndefined();
  });

  it('getSteps() on multi-step path preserves per-step depth', () => {
    const path = graphPath().out('follows').depth(1, 2).to('user').out('wrote').to('post');
    const steps = path.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].depth).toEqual({ min: 1, max: 2 });
    expect(steps[1].depth).toBeUndefined();
  });
});

describe('Adversarial: Chaining after depth()', () => {
  it('can call depth() then to() then add another step', () => {
    const path = graphPath().out('wrote').depth(1, 3).to('post').out('tagged').to('tag');
    expect(path.toString()).toBe('->wrote->post{1,3}->tagged->tag');
    expect(path.getSteps()).toHaveLength(2);
  });

  it('can call depth() then alias() then add another step', () => {
    const path = graphPath()
      .out('wrote')
      .depth(2, 5)
      .alias('posts')
      .in('reviewed_by')
      .alias('reviewer');
    expect(path.toString()).toBe('->wrote->posts{2,5}<-reviewed_by<-reviewer');
    expect(path.getSteps()).toHaveLength(2);
  });

  it('depth() returns same GraphPathContinuation for chaining', () => {
    const cont = graphPath().out('wrote').depth(1, 2);
    // depth() returns GraphPathContinuation, so .to() should work
    const path = cont.to('post');
    expect(path.toString()).toBe('->wrote->post{1,2}');
  });
});
