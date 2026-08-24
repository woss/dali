/**
 * Condition Serializer — shared between SelectBuilder and DeleteBuilder.
 *
 * Extracted from select.ts to avoid duplicating condition tree logic.
 * Pure utility module with no class dependencies.
 */

import type { ConditionOp, SerializedCondition } from './conditions.js';
import type { ConditionNode } from './where-builder.js';

/** Combine two condition trees with AND */
export function andTrees(
  a: ConditionNode | null,
  b: ConditionNode,
): ConditionNode {
  if (!a) return b;
  return {
    type: 'and',
    children: [a, b],
  };
}

/** Convert a SerializedCondition to a special raw condition node */
export function serializedConditionToNode(
  condition: SerializedCondition,
): ConditionNode {
  // Store serialized condition as a special node for later SQL generation
  return {
    type: 'condition',
    field: `_serialized_${condition.sql}`,
    op: '=',
    value: condition,
  };
}

/** Serialize a condition tree to SurrealQL + params */
export function serializeCondition(
  node: ConditionNode,
  nextParam: (value: unknown) => string,
): { sql: string; params: Record<string, unknown> } {
  switch (node.type) {
    case 'condition': {
      // Check for serialized condition stored as special node
      const fieldStr = node.field ?? '';
      if (fieldStr.startsWith('_serialized_')) {
        const stored = node.value as SerializedCondition;
        // Replace parameter placeholders with new ones
        let sql = stored.sql;
        const newParams: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(stored.params)) {
          const newName = nextParam(value);
          sql = sql.replace(`$${key}`, newName);
        }
        return { sql, params: newParams };
      }

      // Check for raw SQL
      if (fieldStr.startsWith('RAW(')) {
        const rawSql = fieldStr.slice(4, -1);
        return { sql: rawSql, params: {} };
      }

      // IN subquery: value contains SQL + params from subquery toSQL()
      if (
        node.op === 'IN' &&
        typeof node.value === 'object' &&
        node.value !== null &&
        (node.value as Record<string, unknown>).__subquery
      ) {
        const info = node.value as {
          sql: string;
          params: Record<string, unknown>;
        };
        let subSQL = info.sql;
        const newParams: Record<string, unknown> = {};
        // Remap subquery param names to avoid collisions with main query
        const sortedKeys = Object.keys(info.params).sort(
          (a, b) => b.length - a.length,
        );
        for (const key of sortedKeys) {
          const newName = nextParam(info.params[key]);
          subSQL = subSQL.replaceAll(`$${key}`, `$${newName}`);
        }
        return { sql: `${node.field} ${node.op} ${subSQL}`, params: newParams };
      }

      // Standard condition
      if (node.op === ('isNone' as ConditionOp))
        return { sql: `${node.field} = NONE`, params: {} };
      if (node.op === ('isNotNull' as ConditionOp))
        return { sql: `${node.field} != NONE`, params: {} };

      // null must be SurrealQL literal, not bound param (bound null → NONE)
      if (node.value === null) {
        const op = node.op ?? '=';
        return { sql: `${node.field} ${op} null`, params: {} };
      }

      const op = node.op ?? '=';
      const param = node.value !== undefined ? nextParam(node.value) : 'true';
      return { sql: `${node.field} ${op} ${param}`, params: {} };
    }

    case 'and': {
      const parts: string[] = [];
      const allParams: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        const { sql, params } = serializeCondition(child, nextParam);
        if (sql) {
          parts.push(sql);
          Object.assign(allParams, params);
        }
      }
      return { sql: parts.join(' AND '), params: allParams };
    }

    case 'or': {
      const parts: string[] = [];
      const allParams: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        const { sql, params } = serializeCondition(child, nextParam);
        if (sql) {
          parts.push(`(${sql})`);
          Object.assign(allParams, params);
        }
      }
      return { sql: parts.join(' OR '), params: allParams };
    }

    case 'not': {
      const child = node.children?.[0];
      if (!child) return { sql: 'true', params: {} };
      const { sql, params } = serializeCondition(child, nextParam);
      return { sql: `NOT (${sql})`, params };
    }

    default:
      return { sql: 'true', params: {} };
  }
}
