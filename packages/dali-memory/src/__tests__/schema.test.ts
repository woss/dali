import { describe, expect, it } from 'vite-plus/test';
import {
  embeddingsSchema,
  factsSchema,
  hasEmbeddingSchema,
  memoriesSchema,
  messagesSchema,
  modelSchema,
  partOfProjectSchema,
  partOfSessionSchema,
  projectsSchema,
  relatesToSchema,
  schema,
  sessionsSchema,
  usesModelSchema,
} from '../schema.ts';

describe('schema', () => {
  describe('tables defined in schema', () => {
    it('defines all 12 tables in orm schema', () => {
      expect(schema.tableCount).toMatchSnapshot();
    });
  });

  describe('embeddingsSchema', () => {
    it('has required fields via $columns lookup', () => {
      expect(Object.keys(embeddingsSchema.$columns ?? {})).toMatchSnapshot();
    });
  });

  describe('modelSchema', () => {
    it('has provider_id and model_id fields', () => {
      expect(Object.keys(modelSchema.$columns ?? {})).toMatchSnapshot();
    });

    it('has unique index on provider_id + model_id', () => {
      expect(modelSchema.config.indexes).toMatchSnapshot();
    });
  });

  describe('memoriesSchema', () => {
    it('has all memory fields', () => {
      expect(Object.keys(memoriesSchema.$columns ?? {})).toMatchSnapshot();
    });
  });

  describe('messagesSchema', () => {
    it('has session record reference', () => {
      expect(Object.keys(messagesSchema.$columns ?? {})).toMatchSnapshot();
    });
  });

  describe('projectsSchema', () => {
    it('has directory_path and name fields', () => {
      expect(Object.keys(projectsSchema.$columns ?? {})).toMatchSnapshot();
    });

    it('has unique index on directory_path', () => {
      expect(projectsSchema.config.indexes).toMatchSnapshot();
    });
  });

  describe('sessionsSchema', () => {
    it('has all session fields', () => {
      expect(Object.keys(sessionsSchema.$columns ?? {})).toMatchSnapshot();
    });
  });

  describe('relation tables', () => {
    it('relatesToSchema links facts to memories', () => {
      expect({
        in: relatesToSchema.config.in,
        out: relatesToSchema.config.out,
      }).toMatchSnapshot();
      expect(Object.keys(relatesToSchema.$columns ?? {})).toMatchSnapshot();
    });

    it('hasEmbeddingSchema links embeddings to memories', () => {
      expect({
        in: hasEmbeddingSchema.config.in,
        out: hasEmbeddingSchema.config.out,
      }).toMatchSnapshot();
    });

    it('partOfProjectSchema links projects to memories', () => {
      expect({
        in: partOfProjectSchema.config.in,
        out: partOfProjectSchema.config.out,
      }).toMatchSnapshot();
      expect(Object.keys(partOfProjectSchema.$columns ?? {})).toMatchSnapshot();
    });

    it('partOfSessionSchema links sessions to memories', () => {
      expect({
        in: partOfSessionSchema.config.in,
        out: partOfSessionSchema.config.out,
      }).toMatchSnapshot();
      expect(Object.keys(partOfSessionSchema.$columns ?? {})).toMatchSnapshot();
    });

    it('usesModelSchema links sessions to models', () => {
      expect({
        in: usesModelSchema.config.in,
        out: usesModelSchema.config.out,
      }).toMatchSnapshot();
      expect(Object.keys(usesModelSchema.$columns ?? {})).toMatchSnapshot();
    });
  });

  describe('factsSchema', () => {
    it('has content, verified, created_at fields', () => {
      expect(Object.keys(factsSchema.$columns ?? {})).toMatchSnapshot();
    });
  });
});
