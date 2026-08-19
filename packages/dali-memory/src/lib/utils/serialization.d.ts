/**
 * Recursively converts non-POJO objects (e.g. SurrealDB datetime, Duration)
 * to their string representations so SvelteKit's devalue serializer can handle them.
 * Plain objects, arrays, and primitives pass through unchanged.
 */
export declare function toPlain<T>(value: T): T;
//# sourceMappingURL=serialization.d.ts.map