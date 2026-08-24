/**
 * Normalize a SurrealDB record ID string to colon-qualified format (`tableName:key`).
 *
 * SurrealDB record IDs have two string representations:
 * - Colon-qualified: `memories:abc123` (SurrealQL syntax)
 * - Angle-bracket: `memories⟨abc123⟩` (`RecordId.toString()` format)
 *
 * This function extracts the key portion and re-qualifies it with the
 * provided `tableName`, always using the parameter's table name regardless
 * of any prefix embedded in `recordId`.
 *
 * @param recordId - The record ID string to normalize (colon-qualified, angle-bracket, or bare key)
 * @param tableName - The target table name to use in the output
 * @returns Colon-qualified record ID in the format `tableName:key`
 * @throws {Error} If `recordId` or `tableName` is empty/missing, or if `recordId` contains an angle-bracket character `<` that isn't the proper `⟨`
 */
export function resolveRecordId(recordId: string, tableName: string): string {
  if (!recordId || typeof recordId !== 'string') {
    throw new Error('Record ID is required');
  }
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Table name is required');
  }

  // Angle-bracket format: table⟨key⟩ (check FIRST — keys may contain colons)
  const openIdx = recordId.indexOf('⟨');
  const closeIdx = recordId.lastIndexOf('⟩');
  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    const key = recordId.substring(openIdx + 1, closeIdx);
    return `${tableName}:${key}`;
  }

  // Already colon-qualified: table:key
  if (recordId.includes(':')) {
    const key = recordId.split(':').slice(1).join(':'); // handle keys with colons
    return `${tableName}:${key}`;
  }

  // Check for invalid ASCII angle brackets
  if (recordId.includes('<') || recordId.includes('>')) {
    throw new Error(
      `Invalid record ID format: '${recordId}' contains ASCII angle brackets. Use Unicode angle brackets (⟨⟩) or colon-qualified format.`,
    );
  }

  // Bare key (no table prefix)
  return `${tableName}:${recordId}`;
}
