/**
 * Relate Query Builder + GraphPath
 *
 * Type-safe RELATE builder for graph edges in SurrealDB.
 * GraphPath provides chainable graph traversal building.
 */

import type { DaliORM } from '../sdk/dali-orm.js';
import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferRelateInput, InferRelateResult } from './types.js';

// ============================================================================
// GraphPath - Chainable Graph Traversal Builder
// ============================================================================

interface GraphStep {
  direction: 'out' | 'in';
  edge: string;
  table?: string;
  alias?: string;
  depth?: { min: number; max?: number };
}

export class GraphPath {
  private steps: GraphStep[] = [];

  /** Start an outgoing traversal: out('wrote') */
  out(edge: string): GraphPathContinuation {
    if (!edge || typeof edge !== 'string')
      throw new Error('Edge name is required');
    return new GraphPathContinuation(this, 'out', edge);
  }

  /** Start an incoming traversal: in('authored') */
  in(edge: string): GraphPathContinuation {
    if (!edge || typeof edge !== 'string')
      throw new Error('Edge name is required');
    return new GraphPathContinuation(this, 'in', edge);
  }

  /** Get the serialized graph path string */
  toString(): string {
    return this.steps
      .map((step) => {
        const arrow = step.direction === 'out' ? '->' : '<-';
        const parts = [`${arrow}${step.edge}`];
        if (step.table) {
          let target = `${arrow}${step.table}`;
          if (step.depth) {
            const { min, max } = step.depth;
            target += max !== undefined ? `{${min},${max}}` : `{${min},}`;
          }
          parts.push(target);
        }
        return parts.join('');
      })
      .join('');
  }

  /** Get steps for inspection */
  getSteps(): ReadonlyArray<GraphStep> {
    return [...this.steps];
  }

  /** Add a step (internal) */
  addStep(step: GraphStep): this {
    this.steps.push(step);
    return this;
  }
}

export class GraphPathContinuation {
  private graphPath: GraphPath;
  private direction: 'out' | 'in';
  private edge: string;
  private _depth?: { min: number; max?: number };

  constructor(graphPath: GraphPath, direction: 'out' | 'in', edge: string) {
    this.graphPath = graphPath;
    this.direction = direction;
    this.edge = edge;
  }

  /** Set depth range for this traversal step */
  depth(min: number, max?: number): GraphPathContinuation {
    if (min < 0) throw new Error('Depth min must be >= 0');
    if (max !== undefined && max < min)
      throw new Error('Depth max must be >= min');
    this._depth = { min, max };
    return this;
  }

  /** Complete the traversal with target table */
  to(table: string): GraphPath {
    if (!table || typeof table !== 'string')
      throw new Error('Table name is required');
    return this.graphPath.addStep({
      direction: this.direction,
      edge: this.edge,
      table,
      depth: this._depth,
    });
  }

  /** Complete the traversal with an alias (target inferred from alias) */
  alias(name: string): GraphPath {
    if (!name || typeof name !== 'string')
      throw new Error('Alias name is required');
    return this.graphPath.addStep({
      direction: this.direction,
      edge: this.edge,
      table: name,
      alias: name,
      depth: this._depth,
    });
  }
}

// ============================================================================
// RelateBuilder
// ============================================================================

/**
 * Type-safe RELATE query builder for graph edges in SurrealDB.
 *
 * Creates graph edges between records. In SurrealDB, `RELATE` links two records
 * via an edge table — a first-class record that can carry its own fields and metadata.
 * Think of it as a named, typed connection between nodes in a graph.
 *
 * ## Field Mapping
 *
 * SurrealDB's `RELATE` syntax creates edges with directional semantics:
 * ```
 * RELATE <from> -> <edge> -> <to> SET ...
 * ```
 *
 * - `.from()` → left side of `->` → SurrealDB `in` field (source/origin record)
 * - `.to()`   → right side of `->` → SurrealDB `out` field (target/destination record)
 *
 * ### Builder-to-SurrealDB Mapping
 *
 * | Builder method | SDK param  | SurrealDB field | Schema constraint |
 * |---------------|------------|-----------------|-------------------|
 * | `.from(id)`   | 1st param  | `in`            | `defineRelationTable(..., { in: 'sourceTable' })` |
 * | `.to(id)`     | 3rd param  | `out`           | `defineRelationTable(..., { out: 'targetTable' })` |
 * | `.set(f, v)`  | data       | edge fields     | Column types in `defineRelationTable(..., { ...fields })` |
 *
 * ## Real-World Usage
 *
 * Insert a memory record, then relate it to a project and a session:
 *
 * ```ts
 * const memory = await insert(driver, memoriesSchema).one({ text }).execute();
 * const record = memory[0];
 *
 * // Link memory to a project
 * if (record?.id) {
 *   await relate(driver, partOfProjectSchema)
 *     .from(String(projectId))
 *     .to(String(record.id))
 *     .set('type', 'project_memory')
 *     .execute();
 *
 *   // Link memory to a session
 *   await relate(driver, partOfSessionSchema)
 *     .from(String(sessionId))
 *     .to(String(record.id))
 *     .set('type', 'session_memory')
 *     .execute();
 * }
 * ```
 *
 * ### Edge schemas
 *
 * ```ts
 * const partOfProjectSchema = defineRelationTable('part_of_project', {
 *   type: string('type'),
 * }, { out: 'memories', in: 'projects' });
 *
 * const partOfSessionSchema = defineRelationTable('part_of_session', {
 *   type: string('type'),
 * }, { out: 'memories', in: 'sessions' });
 * ```
 *
 * > **Key:** `.from()` = source = SurrealDB `in` field. `.to()` = target = SurrealDB `out` field.
 * > Use `.set()` to attach metadata (type, timestamp, score, etc.) to the edge record itself.
 * >
 * > **Terminology note:** The schema `{ in: 'projects', out: 'memories' }` refers to
 * > SurrealDB's type-constraint on the edge table's `in` and `out` fields. It constrains
 * > which record types can appear on each side of `->`. The builder methods `.from()`
 * > and `.to()` map to the same underlying fields.
 */
export class RelateBuilder<
  TEdgeDef extends TableDefinition,
  TResult = InferRelateResult<TEdgeDef>,
> {
  private readonly driver: SurrealDriver;
  private readonly edgeDef: TEdgeDef;
  private _from: string = '';
  private _to: string = '';
  private _data: Partial<InferRelateInput<TEdgeDef>> = {};

  constructor(orm: DaliORM, edgeDef: TEdgeDef) {
    if (!orm) throw new Error('DaliORM instance is required');
    if (!edgeDef?.name)
      throw new Error('Edge table definition with name is required');

    this.driver = orm.getDriver();
    this.edgeDef = edgeDef;
  }

  /**
   * Set the source record (e.g., "user:alice")
   * Maps to SurrealDB's IN field (left side of `->`).
   */
  from(recordId: string): this {
    if (!recordId || typeof recordId !== 'string')
      throw new Error('Source record ID is required');
    this._from = recordId;
    return this;
  }

  /**
   * Set the target record (e.g., "post:123")
   * Maps to SurrealDB's OUT field (right side of `->`).
   */
  to(recordId: string): this {
    if (!recordId || typeof recordId !== 'string')
      throw new Error('Target record ID is required');
    this._to = recordId;
    return this;
  }

  /** Set a single field value on the edge (typed for edge columns) */
  set<K extends keyof InferRelateInput<TEdgeDef>>(
    field: K,
    value: InferRelateInput<TEdgeDef>[K],
  ): this;
  /** Set a single field value on the edge (untyped fallback) */
  set(field: string, value: unknown): this;
  set(field: string, value: unknown): this {
    if (!field || typeof field !== 'string')
      throw new Error('Field name is required');
    (this._data as Record<string, unknown>)[field] = value;
    return this;
  }

  /** Set all edge data at once (typed for edge columns) */
  data(obj: Partial<InferRelateInput<TEdgeDef>>): this;
  /** Set all edge data at once (untyped fallback) */
  data(obj: Record<string, unknown>): this;
  data(
    obj: Partial<InferRelateInput<TEdgeDef>> | Record<string, unknown>,
  ): this {
    if (!obj || typeof obj !== 'object')
      throw new Error('Data object is required');
    this._data = { ...obj } as Partial<InferRelateInput<TEdgeDef>>;
    return this;
  }

  /** Execute the RELATE query */
  async execute(): Promise<TResult[]> {
    if (!this._from)
      throw new Error('Source record is required - use .from() to set it');
    if (!this._to)
      throw new Error('Target record is required - use .to() to set it');

    return this.driver.relate<TResult>(
      this._from,
      this.edgeDef.name,
      this._to,
      this._data,
    );
  }
}

/**
 * Create a RELATE query builder for graph edges between records.
 *
 * In SurrealDB, `RELATE` creates a directed edge between two records via a
 * relationship table. The edge is a first-class record with its own fields
 * and metadata — the graph equivalent of a foreign-key join.
 *
 * ## Usage Pattern
 *
 * Insert a record, then link it to a parent entity (project, session, etc.):
 *
 * ```ts
 * import { relate } from '@woss/dali-orm/query';
 * import { defineRelationTable } from '@woss/dali-orm/sdk/table';
 * import { string } from '@woss/dali-orm/sdk/schema/column/simple-builders';
 *
 * // 1. Define edge schema
 * const partOfProjectSchema = defineRelationTable('part_of_project', {
 *   type: string('type'),
 * }, { out: 'memories', in: 'projects' });
 *
 * // 2. Insert a memory, then relate it to a project
 * const result = await insert(driver, memoriesSchema).one(memory).execute();
 * const record = result[0];
 * if (record?.id) {
 *   const links = await relate(driver, partOfProjectSchema)
 *     .from(String(projectId))    // source node
 *     .to(String(record.id))      // target node
 *     .set('type', 'project_memory')
 *     .execute();
 * }
 * ```
 *
 * @param orm - DaliORM instance
 * @param edgeDef - Edge table definition from `defineRelationTable()`
 * @returns A `RelateBuilder` instance for chaining `.from()`, `.to()`, `.set()`, `.execute()`
 */
export function relate<TEdgeDef extends TableDefinition>(
  orm: DaliORM,
  edgeDef: TEdgeDef,
): RelateBuilder<TEdgeDef> {
  return new RelateBuilder(orm, edgeDef);
}

/** Create a new GraphPath builder */
export function graphPath(): GraphPath {
  return new GraphPath();
}
