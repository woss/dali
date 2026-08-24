/**
 * Relate Query Builder + GraphPath
 *
 * Type-safe RELATE builder for graph edges in SurrealDB.
 * GraphPath provides chainable graph traversal building.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferRelateInput, InferRelateResult } from './types.js';

interface GraphStep {
  direction: 'out' | 'in';
  edge: string;
  table?: string;
  alias?: string;
  depth?: {
    min: number;
    max?: number;
  };
}
export declare class GraphPath {
  private steps;
  /** Start an outgoing traversal: out('wrote') */
  out(edge: string): GraphPathContinuation;
  /** Start an incoming traversal: in('authored') */
  in(edge: string): GraphPathContinuation;
  /** Get the serialized graph path string */
  toString(): string;
  /** Get steps for inspection */
  getSteps(): ReadonlyArray<GraphStep>;
  /** Add a step (internal) */
  addStep(step: GraphStep): this;
}
export declare class GraphPathContinuation {
  private graphPath;
  private direction;
  private edge;
  private _depth?;
  constructor(graphPath: GraphPath, direction: 'out' | 'in', edge: string);
  /** Set depth range for this traversal step */
  depth(min: number, max?: number): GraphPathContinuation;
  /** Complete the traversal with target table */
  to(table: string): GraphPath;
  /** Complete the traversal with an alias (target inferred from alias) */
  alias(name: string): GraphPath;
}
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
export declare class RelateBuilder<
  TEdgeDef extends TableDefinition,
  TResult = InferRelateResult<TEdgeDef>,
> {
  private readonly driver;
  private readonly edgeDef;
  private _from;
  private _to;
  private _data;
  constructor(orm: DaliORM, edgeDef: TEdgeDef);
  /**
   * Set the source record (e.g., "user:alice")
   * Maps to SurrealDB's IN field (left side of `->`).
   */
  from(recordId: string): this;
  /**
   * Set the target record (e.g., "post:123")
   * Maps to SurrealDB's OUT field (right side of `->`).
   */
  to(recordId: string): this;
  /** Set a single field value on the edge (typed for edge columns) */
  set<K extends keyof InferRelateInput<TEdgeDef>>(
    field: K,
    value: InferRelateInput<TEdgeDef>[K],
  ): this;
  /** Set a single field value on the edge (untyped fallback) */
  set(field: string, value: unknown): this;
  /** Set all edge data at once (typed for edge columns) */
  data(obj: Partial<InferRelateInput<TEdgeDef>>): this;
  /** Set all edge data at once (untyped fallback) */
  data(obj: Record<string, unknown>): this;
  /** Execute the RELATE query */
  execute(): Promise<TResult[]>;
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
export declare function relate<TEdgeDef extends TableDefinition>(
  orm: DaliORM,
  edgeDef: TEdgeDef,
): RelateBuilder<TEdgeDef>;
/** Create a new GraphPath builder */
export declare function graphPath(): GraphPath;
//# sourceMappingURL=relate.d.ts.map
