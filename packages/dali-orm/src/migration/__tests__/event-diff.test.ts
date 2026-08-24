import { describe, expect, it } from 'vitest';
import { SurrealQLGenerator } from '../core/generator.js';
import { fromSurrealEvent, toSurrealEvent } from '../ddl/convert.js';
import { createEmptyDdl, type SurrealDbDDL, type SurrealEvent } from '../ddl/ddl.js';
import { ddlDiff } from '../ddl/diff.js';

const generator = new SurrealQLGenerator();

function createDdlWithEvents(events: SurrealEvent[]): SurrealDbDDL {
  const ddl = createEmptyDdl();
  ddl.events = events;
  return ddl;
}

describe('event DDL diff', () => {
  it('detects new event definition', async () => {
    const current = createDdlWithEvents([]);
    const target = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_event') {
      expect(createStmts[0].event.name).toBe('user_created');
    }
  });

  it('detects multiple new events', async () => {
    const current = createDdlWithEvents([]);
    const target = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
      {
        name: 'user_updated',
        what: 'user',
        when: '$after',
        then: ['UPDATE audit SET action = "update"'],
      },
      {
        name: 'order_placed',
        what: 'order',
        when: '$before',
        then: ['UPDATE inventory SET stock = stock - 1'],
      },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    expect(createStmts).toHaveLength(3);
  });

  it('detects changed event (drop + recreate)', async () => {
    const current = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);
    const target = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()', 'UPDATE audit SET action = "created"'],
      },
    ]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter((s) => s.type === 'drop_event');
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    expect(dropStmts).toHaveLength(1);
    expect(createStmts).toHaveLength(1);
    if (dropStmts[0].type === 'drop_event') {
      expect(dropStmts[0].name).toBe('user_created');
    }
  });

  it('detects no changes for identical events', async () => {
    const event: SurrealEvent = {
      name: 'user_created',
      what: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
    };
    const current = createDdlWithEvents([event]);
    const target = createDdlWithEvents([event]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    const dropStmts = result.statements.filter((s) => s.type === 'drop_event');
    expect(createStmts).toHaveLength(0);
    expect(dropStmts).toHaveLength(0);
  });

  it('returns empty for empty events arrays', async () => {
    const current = createDdlWithEvents([]);
    const target = createDdlWithEvents([]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    const dropStmts = result.statements.filter((s) => s.type === 'drop_event');
    expect(createStmts).toHaveLength(0);
    expect(dropStmts).toHaveLength(0);
  });

  it('does NOT detect removal of events (safety-first)', async () => {
    const current = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);
    const target = createDdlWithEvents([]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter((s) => s.type === 'drop_event');
    expect(dropStmts).toHaveLength(0);
  });

  it('detects only new events when mixing existing and new', async () => {
    const current = createDdlWithEvents([
      {
        name: 'existing_event',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);
    const target = createDdlWithEvents([
      {
        name: 'existing_event',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
      {
        name: 'new_event',
        what: 'order',
        when: '$after',
        then: ['UPDATE audit SET action = "ordered"'],
      },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_event');
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_event') {
      expect(createStmts[0].event.name).toBe('new_event');
    }
  });
});

describe('event SQL generation', () => {
  it('generates DEFINE EVENT SQL with required fields', () => {
    const sql = generator.generateEventDefinition({
      name: 'user_created',
      what: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
    });
    expect(sql).toContain('DEFINE EVENT IF NOT EXISTS user_created ON TABLE user');
    expect(sql).toContain('WHEN ($before)');
    expect(sql).toContain('THEN { UPDATE user SET updated_at = time::now() }');
  });

  it('generates DEFINE EVENT SQL with COMMENT', () => {
    const sql = generator.generateEventDefinition({
      name: 'user_created',
      what: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
      comment: 'Track user creation timestamps',
    });
    expect(sql).toContain('COMMENT "Track user creation timestamps"');
  });

  it('generates DEFINE EVENT SQL with ASYNC, RETRY, MAXDEPTH', () => {
    const sql = generator.generateEventDefinition({
      name: 'order_processed',
      what: 'order',
      when: '$after',
      then: ['UPDATE inventory SET stock = stock - 1'],
      async: true,
      retry: 3,
      maxdepth: 5,
    });
    expect(sql).toContain('ASYNC');
    expect(sql).toContain('RETRY 3');
    expect(sql).toContain('MAXDEPTH 5');
  });

  it('generates REMOVE EVENT SQL', () => {
    const sql = generator.generateRemoveEvent('user_created', 'user');
    expect(sql).toBe('REMOVE EVENT IF EXISTS user_created ON TABLE user');
  });

  it('generates event migration up (DEFINE EVENT)', () => {
    const event: SurrealEvent = {
      name: 'user_created',
      what: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
    };
    const sql = generator.generateEventMigration(event);
    expect(sql).toContain('DEFINE EVENT IF NOT EXISTS user_created ON TABLE user');
    expect(sql).toContain('WHEN ($before)');
  });
});

describe('event statementToSql', () => {
  it('converts create_event statement to SQL', async () => {
    const current = createDdlWithEvents([]);
    const target = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);

    const result = await ddlDiff(current, target);
    expect(result.sqlStatements.length).toBeGreaterThan(0);

    const eventSql = result.sqlStatements.find((s) => s.includes('DEFINE EVENT'));
    expect(eventSql).toBeDefined();
    expect(eventSql).toContain('DEFINE EVENT IF NOT EXISTS user_created ON TABLE user');
    expect(eventSql).toContain('WHEN ($before)');
    expect(eventSql).toContain('THEN { UPDATE user SET updated_at = time::now() }');
  });

  it('converts drop_event statement to SQL', async () => {
    const current = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()'],
      },
    ]);
    const target = createDdlWithEvents([
      {
        name: 'user_created',
        what: 'user',
        when: '$before',
        then: ['UPDATE user SET updated_at = time::now()', 'UPDATE audit SET action = "created"'],
      },
    ]);

    const result = await ddlDiff(current, target);
    const dropSql = result.sqlStatements.find((s) => s.includes('REMOVE EVENT'));
    expect(dropSql).toBeDefined();
    expect(dropSql).toBe('REMOVE EVENT IF EXISTS user_created ON TABLE user');
  });
});

describe('event conversion', () => {
  it('toSurrealEvent converts EventConfig to SurrealEvent', () => {
    const result = toSurrealEvent({
      name: 'user_created',
      on: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
    });
    expect(result.name).toBe('user_created');
    expect(result.what).toBe('user');
    expect(result.when).toBe('$before');
    expect(result.then).toEqual(['UPDATE user SET updated_at = time::now()']);
  });

  it('toSurrealEvent converts EventConfig with all optional fields', () => {
    const result = toSurrealEvent({
      name: 'order_processed',
      on: 'order',
      when: '$after',
      then: ['UPDATE inventory SET stock = stock - 1'],
      comment: 'Order processing',
      async: true,
      retry: 3,
      maxdepth: 5,
    });
    expect(result.name).toBe('order_processed');
    expect(result.comment).toBe('Order processing');
    expect(result.async).toBe(true);
    expect(result.retry).toBe(3);
    expect(result.maxdepth).toBe(5);
  });

  it('fromSurrealEvent converts SurrealEvent back to EventConfig', () => {
    const result = fromSurrealEvent({
      name: 'user_created',
      what: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
    });
    expect(result.name).toBe('user_created');
    expect(result.on).toBe('user');
    expect(result.when).toBe('$before');
    expect(result.then).toEqual(['UPDATE user SET updated_at = time::now()']);
  });

  it('fromSurrealEvent handles async events', () => {
    const result = fromSurrealEvent({
      name: 'order_processed',
      what: 'order',
      when: '$after',
      then: ['UPDATE inventory SET stock = stock - 1'],
      async: true,
      retry: 3,
      maxdepth: 5,
    });
    expect(result.async).toBe(true);
    expect(result.retry).toBe(3);
    expect(result.maxdepth).toBe(5);
  });

  it('round-trip: EventConfig to SurrealEvent to EventConfig preserves fields', () => {
    const config = {
      name: 'user_created',
      on: 'user',
      when: '$before',
      then: ['UPDATE user SET updated_at = time::now()'],
      comment: 'Track creation',
      async: true,
      retry: 3,
      maxdepth: 5,
    };
    const surrealEvent = toSurrealEvent(config);
    const result = fromSurrealEvent(surrealEvent);

    expect(result.name).toBe(config.name);
    expect(result.on).toBe(config.on);
    expect(result.when).toBe(config.when);
    expect(result.then).toEqual(config.then);
    expect(result.comment).toBe(config.comment);
    expect(result.async).toBe(config.async);
    expect(result.retry).toBe(config.retry);
    expect(result.maxdepth).toBe(config.maxdepth);
  });

  it('throws for null/undefined input to toSurrealEvent', () => {
    expect(() => toSurrealEvent(null as unknown as Parameters<typeof toSurrealEvent>[0])).toThrow(
      'EventConfig required',
    );
  });

  it('throws for null/undefined input to fromSurrealEvent', () => {
    expect(() =>
      fromSurrealEvent(null as unknown as Parameters<typeof fromSurrealEvent>[0]),
    ).toThrow('SurrealEvent required');
  });
});
