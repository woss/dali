import { describe, expect, it } from 'vite-plus/test';
import { defineEvent } from '../schema/event-builder.js';

describe('defineEvent builder', () => {
  it('creates event with name and required fields', () => {
    const evt = defineEvent('user_created')
      .on('user')
      .when('$before')
      .then('UPDATE user SET updated_at = time::now()')
      .build();

    expect(evt.name).toBe('user_created');
    expect(evt.on).toBe('user');
    expect(evt.when).toBe('$before');
    expect(evt.then).toEqual(['UPDATE user SET updated_at = time::now()']);
  });

  it('sets table via on()', () => {
    const evt = defineEvent('evt').on('user').when('$before').then('DELETE *').build();
    expect(evt.on).toBe('user');
  });

  it('sets when condition', () => {
    const evt = defineEvent('evt').on('user').when('$before OR $after').then('DELETE *').build();
    expect(evt.when).toBe('$before OR $after');
  });

  it('adds multiple then statements', () => {
    const evt = defineEvent('multi_then')
      .on('user')
      .when('$after')
      .then('UPDATE user SET updated_at = time::now()')
      .then('INSERT INTO audit SET action = "update"')
      .then('UPDATE stats SET total = total + 1')
      .build();

    expect(evt.then).toHaveLength(3);
    expect(evt.then[0]).toContain('updated_at');
    expect(evt.then[1]).toContain('audit');
    expect(evt.then[2]).toContain('stats');
  });

  it('sets comment', () => {
    const evt = defineEvent('evt')
      .on('user')
      .when('$before')
      .then('DELETE *')
      .comment('Track user deletions')
      .build();
    expect(evt.comment).toBe('Track user deletions');
  });

  it('sets async', () => {
    const evt = defineEvent('evt').on('user').when('$before').then('DELETE *').async().build();
    expect(evt.async).toBe(true);
  });

  it('sets retry', () => {
    const evt = defineEvent('evt')
      .on('user')
      .when('$after')
      .then('UPDATE user SET status = "processed"')
      .retry(3)
      .build();
    expect(evt.retry).toBe(3);
  });

  it('sets maxdepth', () => {
    const evt = defineEvent('evt')
      .on('user')
      .when('$after')
      .then('UPDATE user SET status = "processed"')
      .maxdepth(10)
      .build();
    expect(evt.maxdepth).toBe(10);
  });

  it('generates DEFINE EVENT SQL via toSQL()', () => {
    const sql = defineEvent('on_user_update')
      .on('user')
      .when('$before OR $after')
      .then('UPDATE stats SET updated_at = time::now()')
      .then('INSERT INTO audit SET action = "update"')
      .comment('Track user changes')
      .async()
      .retry(3)
      .maxdepth(5)
      .toSQL();

    expect(sql).toContain('DEFINE EVENT IF NOT EXISTS on_user_update');
    expect(sql).toContain('ON TABLE user');
    expect(sql).toContain('WHEN ($before OR $after)');
    expect(sql).toContain(
      'THEN { UPDATE stats SET updated_at = time::now(); INSERT INTO audit SET action = "update" }',
    );
    expect(sql).toContain('COMMENT "Track user changes"');
    expect(sql).toContain('ASYNC');
    expect(sql).toContain('RETRY 3');
    expect(sql).toContain('MAXDEPTH 5');
  });

  it('throws on empty name', () => {
    expect(() => defineEvent('').build()).toThrow('Event name is required');
  });

  it('throws on missing table in build()', () => {
    expect(() => defineEvent('evt').when('$before').then('DELETE *').build()).toThrow(
      'Table name is required',
    );
  });

  it('throws on missing when in build()', () => {
    expect(() => defineEvent('evt').on('user').then('DELETE *').build()).toThrow(
      'WHEN condition is required',
    );
  });

  it('throws on missing then in build()', () => {
    expect(() => defineEvent('evt').on('user').when('$before').build()).toThrow(
      'At least one THEN statement is required',
    );
  });

  it('chains all properties', () => {
    const evt = defineEvent('full_chain')
      .on('person')
      .when('$after')
      .then('UPDATE person SET updated_at = time::now()')
      .then('INSERT INTO log SET event = "update"')
      .comment('Full chain test')
      .async()
      .retry(5)
      .maxdepth(3)
      .build();

    expect(evt.name).toBe('full_chain');
    expect(evt.on).toBe('person');
    expect(evt.when).toBe('$after');
    expect(evt.then).toHaveLength(2);
    expect(evt.comment).toBe('Full chain test');
    expect(evt.async).toBe(true);
    expect(evt.retry).toBe(5);
    expect(evt.maxdepth).toBe(3);
  });

  it('produces different instances from same factory', () => {
    const builder1 = defineEvent('event_a')
      .on('user')
      .when('$before')
      .then('UPDATE user SET x = 1');
    const builder2 = defineEvent('event_b')
      .on('user')
      .when('$before')
      .then('UPDATE user SET x = 1');

    expect(builder1.build().name).toBe('event_a');
    expect(builder2.build().name).toBe('event_b');
    expect(builder1).not.toBe(builder2);
  });
});
