import { describe, expect, it } from 'vitest';
import type { AnalyzerDefinition } from '../table.js';
import { OrmSchema, type OrmSchemaConfig } from '../orm-schema.js';

// =============================================================================
// AnalyzerDefinition type + OrmSchema analyzers integration
// =============================================================================

describe('AnalyzerDefinition', () => {
  it('creates minimal analyzer (string tokenizers)', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'my_analyzer',
      tokenizers: 'class',
    };
    expect(analyzer.name).toBe('my_analyzer');
    expect(analyzer.tokenizers).toBe('class');
    expect(analyzer.filters).toBeUndefined();
  });

  it('creates analyzer with array tokenizers', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'multi_tokenizer',
      tokenizers: ['class', 'blank'],
    };
    expect(analyzer.name).toBe('multi_tokenizer');
    expect(analyzer.tokenizers).toEqual(['class', 'blank']);
  });

  it('creates analyzer with optional filters', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'filtered_analyzer',
      tokenizers: 'class',
      filters: ['lowercase', 'snowball'],
    };
    expect(analyzer.name).toBe('filtered_analyzer');
    expect(analyzer.filters).toEqual(['lowercase', 'snowball']);
  });

  it('creates analyzer with string filter', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'single_filter',
      tokenizers: 'class',
      filters: 'lowercase',
    };
    expect(analyzer.filters).toBe('lowercase');
  });
});

describe('OrmSchema with analyzers', () => {
  it('creates schema with analyzers', () => {
    const analyzers: AnalyzerDefinition[] = [
      {
        name: 'my_analyzer',
        tokenizers: 'class',
        filters: ['lowercase', 'snowball'],
      },
    ];

    const schema = new OrmSchema({
      tables: {},
      analyzers,
    });

    expect(schema.analyzers).toHaveLength(1);
    expect(schema.analyzers[0].name).toBe('my_analyzer');
    expect(schema.analyzers[0].tokenizers).toBe('class');
    expect(schema.analyzers[0].filters).toEqual(['lowercase', 'snowball']);
  });

  it('getAnalyzers returns a copy of analyzers', () => {
    const analyzers: AnalyzerDefinition[] = [{ name: 'a1', tokenizers: 'class' }];

    const schema = new OrmSchema({ tables: {}, analyzers });
    const result = schema.getAnalyzers();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('a1');

    // Verify it's a copy, not the same reference
    result.push({ name: 'a2', tokenizers: 'blank' });
    expect(schema.analyzers).toHaveLength(1);
  });

  it('handles empty analyzers', () => {
    const schema = new OrmSchema({ tables: {} });
    expect(schema.analyzers).toEqual([]);
    expect(schema.getAnalyzers()).toEqual([]);
  });

  it('works with create factory method', () => {
    const schema = OrmSchema.create({
      tables: {},
      analyzers: [{ name: 'ft_analyzer', tokenizers: 'class', filters: ['lowercase'] }],
    });

    const result = schema.getAnalyzers();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ft_analyzer');
  });

  it('works with createOrmSchema factory function', async () => {
    const { createOrmSchema } = await import('../orm-schema.js');
    const schema = createOrmSchema({
      tables: {},
      analyzers: [{ name: 'factory_analyzer', tokenizers: ['class', 'blank'] }],
    });

    expect(schema.getAnalyzers()).toHaveLength(1);
    expect(schema.getAnalyzers()[0].name).toBe('factory_analyzer');
  });
});

describe('OrmSchemaConfig type compatibility', () => {
  it('accepts analyzers in config', () => {
    const config: OrmSchemaConfig = {
      tables: {},
      analyzers: [{ name: 'a1', tokenizers: 'class' }],
    };

    // Verify config is assignable (type-level check)
    expect(config.analyzers).toBeDefined();
    expect(config.analyzers).toHaveLength(1);
  });

  it('allows omitting analyzers', () => {
    const config: OrmSchemaConfig = {
      tables: {},
    };
    expect(config.analyzers).toBeUndefined();
  });
});
