/**
 * Canonical SurrealQL serialization module.
 *
 * Provides primitives for escaping, quoting, and serializing values into
 * safe SurrealQL strings. Every exported function is pure — no I/O, no
 * side effects, no dependencies beyond TypeScript built-ins.
 *
 * ## Quick reference
 *
 * | Function | Purpose |
 * |----------|---------|
 * | `escapeIdent` | Escape a SurrealQL identifier (table/field name) |
 * | `escapeString` | Escape string content (inner, no surrounding quotes) |
 * | `quoteString` | Wrap in single quotes with proper escaping |
 * | `raw` / `isRaw` / `surql` | Branded raw-SQL marker + template tag |
 * | `serializeValue` | Serialize any value to SurrealQL literal |
 * | `formatDefault` | Serialize a DEFAULT clause value (raw-aware, no heuristic) |
 * | `serializePermissionsFragment` | Serialize PERMISSIONS block |
 *
 * @module
 */
/**
 * A branded raw SurrealQL fragment.
 *
 * Values wrapped via {@link raw} carry the `__surqlRaw` brand so the
 * serializer passes them through unquoted.  Never construct this object
 * manually — use {@link raw} or the {@link surql} template tag.
 */
export interface RawSurql {
    /** Brand discriminator — always `true` for raw fragments. */
    readonly __surqlRaw: true;
    /** The raw SurrealQL source text. */
    readonly sql: string;
}
/**
 * Escape a SurrealQL identifier.
 *
 * Plain identifiers (`foo`, `_bar`, `_123`) pass through unchanged.
 * Everything else is wrapped in backticks with internal backslashes and
 * backticks escaped.
 *
 * @param name - Identifier string (table name, field name, etc.)
 * @returns Safe SurrealQL identifier expression.
 *
 * @example
 * ```ts
 * escapeIdent('foo')       // 'foo'
 * escapeIdent('my field')  // '`my field`'
 * escapeIdent('a`b')       // '`a\`b`'
 * ```
 */
export declare function escapeIdent(name: string): string;
/**
 * Escape string content for a SurrealQL single-quoted string literal.
 *
 * This returns the *inner* content — no surrounding quotes.  Backslashes
 * are escaped first, then single quotes, then the control characters
 * `\n`, `\t`, `\r`.  Any remaining character with code point < 0x20 is
 * emitted as a `\u00XX` hex escape.
 *
 * @param s - Raw string content.
 * @returns Escaped content safe for embedding in a SurrealQL string literal.
 *
 * @example
 * ```ts
 * escapeString("it's")       // "it\\'s"
 * escapeString("a\nb")       // "a\\nb"
 * escapeString("a\\b")       // "a\\\\b"
 * ```
 */
export declare function escapeString(s: string): string;
/**
 * Wrap a string in single quotes with proper SurrealQL escaping.
 *
 * @param s - Raw string content.
 * @returns A SurrealQL string literal including surrounding quotes.
 *
 * @example
 * ```ts
 * quoteString("hello")   // "'hello'"
 * quoteString("it's")    // "'it\\'s'"
 * ```
 */
export declare function quoteString(s: string): string;
/**
 * Create a branded raw SurrealQL fragment.
 *
 * The resulting object passes through `serializeValue` and
 * `formatDefault` **unquoted** — use this to inject trusted SQL
 * expressions (function calls, operators, etc.) that must not be quoted.
 *
 * @param sql - Trusted SurrealQL source text.
 * @returns A branded raw fragment.
 *
 * @example
 * ```ts
 * raw('time::now()')           // → { __surqlRaw: true, sql: 'time::now()' }
 * serializeValue(raw('NOW()')) // → 'NOW()'  (no quotes)
 * ```
 */
export declare function raw(sql: string): RawSurql;
/**
 * Type guard that narrows a value to {@link RawSurql}.
 *
 * @param v - Value to check.
 * @returns `true` if `v` is a raw SurrealQL fragment.
 */
export declare function isRaw(v: unknown): v is RawSurql;
/**
 * Serialize an arbitrary value into a SurrealQL literal.
 *
 * | Input | Output |
 * |-------|--------|
 * | {@link RawSurql} | `sql` property (passthrough, unquoted) |
 * | `string` | Single-quoted with {@link quoteString} |
 * | `number` | Decimal string |
 * | `boolean` | `'true'` / `'false'` |
 * | `null` | `'null'` |
 * | `undefined` | `'NONE'` |
 * | `Date` | `d'<ISO8601>'` datetime literal |
 * | `Array` | `[<serialized>, …]` |
 * | Plain object | `{ <ident>: <serialized>, … }` |
 *
 * @param v - Value to serialize.
 * @returns SurrealQL literal string.
 */
export declare function serializeValue(v: unknown): string;
/**
 * Serialize a value for use in a SurrealQL `DEFAULT` clause.
 *
 * Behaves identically to {@link serializeValue} — strings are always
 * quoted and raw markers pass through unquoted.  There is **no**
 * heuristic detection of function-like strings: the string
 * `'time::now()'` is emitted as a quoted string literal, **not** an
 * unquoted expression.  To inject a raw expression use {@link raw}.
 *
 * @param v - Value to format.
 * @returns SurrealQL literal suitable for a `DEFAULT` clause.
 */
export declare function formatDefault(v: unknown): string;
/**
 * Tagged-template helper that builds a {@link RawSurql} fragment.
 *
 * Interpolated values are serialized via {@link serializeValue} so
 * strings are quoted automatically, while {@link raw} markers and other
 * primitives are handled correctly.
 *
 * @param strings - Template literal string parts.
 * @param values - Interpolated values.
 * @returns A branded raw SurrealQL fragment.
 *
 * @example
 * ```ts
 * const field = surql`time::now()`         // raw marker
 * const expr  = surql`${raw('1 + 1')}`     // → 1 + 1  (unquoted)
 * const q     = surql`name = ${'Alice'}`   // → name = 'Alice'
 * ```
 */
export declare function surql(strings: TemplateStringsArray, ...values: unknown[]): RawSurql;
/**
 * Serialize a permissions object into a SurrealQL `PERMISSIONS` clause.
 *
 * Each defined key produces a clause joined by **single spaces** (no
 * commas).  `true` → `FOR <op> FULL`, `false` → `FOR <op> NONE`,
 * `string` → `FOR <op> WHERE <expr>`.
 *
 * @param perms - Permissions configuration.  Omitted keys are skipped.
 * @returns SurrealQL permissions clause fragment (empty string when no
 *          keys are defined).
 *
 * @example
 * ```ts
 * serializePermissionsFragment({ select: true, delete: false })
 * // → 'FOR select FULL FOR delete NONE'
 *
 * serializePermissionsFragment({ select: 'age > 18' })
 * // → 'FOR select WHERE age > 18'
 *
 * serializePermissionsFragment({ select: true, create: false, update: 'role = "admin"', delete: false })
 * // → 'FOR select FULL FOR create NONE FOR update WHERE role = "admin" FOR delete NONE'
 * ```
 */
export declare function serializePermissionsFragment(perms: {
    select?: string | boolean;
    create?: string | boolean;
    update?: string | boolean;
    delete?: string | boolean;
}): string;
//# sourceMappingURL=surql.d.ts.map