/**
 * Serialize column permissions object to SQL string for ColumnDefinition
 */
export function serializeColumnPermissions(
  perms:
    | {
        select?: string | boolean;
        create?: string | boolean;
        update?: string | boolean;
        delete?: string | boolean;
      }
    | undefined,
): string | undefined {
  if (!perms) return undefined;
  const parts: string[] = [];
  if (perms.select !== undefined)
    parts.push(
      `FOR select ${typeof perms.select === 'string' ? perms.select : perms.select ? 'FULL' : 'NONE'}`,
    );
  if (perms.create !== undefined)
    parts.push(
      `FOR create ${typeof perms.create === 'string' ? perms.create : perms.create ? 'FULL' : 'NONE'}`,
    );
  if (perms.update !== undefined)
    parts.push(
      `FOR update ${typeof perms.update === 'string' ? perms.update : perms.update ? 'FULL' : 'NONE'}`,
    );
  if (perms.delete !== undefined)
    parts.push(
      `FOR delete ${typeof perms.delete === 'string' ? perms.delete : perms.delete ? 'FULL' : 'NONE'}`,
    );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Normalize SQL for comparison: strip whitespace, sort lines
 */
export function normalizeSql(sql: string): string {
  return sql
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
    .sort()
    .join('\n');
}
