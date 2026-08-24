/**
 * Condition Serializer — shared between SelectBuilder and DeleteBuilder.
 *
 * Extracted from select.ts to avoid duplicating condition tree logic.
 * Pure utility module with no class dependencies.
 */
import type { SerializedCondition } from './conditions.js';
import type { ConditionNode } from './where-builder.js';
/** Combine two condition trees with AND */
export declare function andTrees(
  a: ConditionNode | null,
  b: ConditionNode,
): ConditionNode;
/** Convert a SerializedCondition to a special raw condition node */
export declare function serializedConditionToNode(
  condition: SerializedCondition,
): ConditionNode;
/** Serialize a condition tree to SurrealQL + params */
export declare function serializeCondition(
  node: ConditionNode,
  nextParam: (value: unknown) => string,
): {
  sql: string;
  params: Record<string, unknown>;
};
//# sourceMappingURL=serializer.d.ts.map
