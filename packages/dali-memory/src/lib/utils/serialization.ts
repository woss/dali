function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && value.constructor === Object;
}

function isSerializablePrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Recursively converts non-POJO objects (e.g. SurrealDB datetime, Duration)
 * to their string representations so SvelteKit's devalue serializer can handle them.
 * Plain objects, arrays, and primitives pass through unchanged.
 */
export function toPlain<T>(value: T): T {
  if (isSerializablePrimitive(value)) return value;

  if (Array.isArray(value)) {
    return value.map(toPlain) as unknown as T;
  }

  // Date objects are serializable by devalue
  if (value instanceof Date) return value;

  if (typeof value === 'object') {
    // Non-POJO custom object (e.g. SurrealDB datetime) -> convert to string
    if (!isPlainObject(value)) {
      return String(value) as unknown as T;
    }
    // Plain object -> recursively convert values
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toPlain(val);
    }
    return result as unknown as T;
  }

  return value;
}
