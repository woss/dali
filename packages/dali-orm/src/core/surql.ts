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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Identifier escaping
// ---------------------------------------------------------------------------

/**
 * Pattern that matches identifiers requiring no quoting.
 *
 * SurrealQL permits bare `[A-Za-z_][A-Za-z0-9_]*` identifiers.  Anything
 * outside this pattern must be backtick-quoted.
 */
const PLAIN_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
export function escapeIdent(name: string): string {
  if (PLAIN_IDENT_RE.test(name)) {
    return name;
  }
  // Escape backslashes FIRST, then backticks, so a literal backslash
  // before a backtick doesn't produce an unescaped backtick.
  const escaped = name.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return `\`${escaped}\``;
}

// ---------------------------------------------------------------------------
// String escaping & quoting
// ---------------------------------------------------------------------------

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
export function escapeString(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);

    if (ch === '\\') {
      result += '\\\\';
    } else if (ch === "'") {
      result += "\\'";
    } else if (ch === '\n') {
      result += '\\n';
    } else if (ch === '\t') {
      result += '\\t';
    } else if (ch === '\r') {
      result += '\\r';
    } else if (code < 0x20) {
      // Any remaining control character — hex escape.
      result += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      result += ch;
    }
  }
  return result;
}

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
export function quoteString(s: string): string {
  return `'${escapeString(s)}'`;
}

// ---------------------------------------------------------------------------
// Raw SQL marker
// ---------------------------------------------------------------------------

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
export function raw(sql: string): RawSurql {
  return { __surqlRaw: true, sql };
}

/**
 * Type guard that narrows a value to {@link RawSurql}.
 *
 * @param v - Value to check.
 * @returns `true` if `v` is a raw SurrealQL fragment.
 */
export function isRaw(v: unknown): v is RawSurql {
  return (
    typeof v === 'object' && v !== null && '__surqlRaw' in v && (v as RawSurql).__surqlRaw === true
  );
}

// ---------------------------------------------------------------------------
// Value serialization
// ---------------------------------------------------------------------------

/**
 * Test whether a value is a "plain" object (not Array, Date, or null).
 *
 * @param v - Value to test.
 * @returns `true` for plain `{}` / `Object.create(null)` objects.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || v === undefined || typeof v !== 'object') return false;
  if (Array.isArray(v) || v instanceof Date) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

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
export function serializeValue(v: unknown): string {
  // Raw marker — passthrough the SQL text unquoted.
  if (isRaw(v)) {
    return v.sql;
  }

  // Primitive types.
  if (typeof v === 'string') {
    return quoteString(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v);
  }
  if (v === null) {
    return 'null';
  }
  if (v === undefined) {
    return 'NONE';
  }

  // Date → d'<ISO8601>' datetime literal.
  if (v instanceof Date) {
    return `d'${v.toISOString()}'`;
  }

  // Array → [elem, …].
  if (Array.isArray(v)) {
    const items = v.map(serializeValue);
    return `[${items.join(', ')}]`;
  }

  // Plain object → { key: val, … }.
  if (isPlainObject(v)) {
    const entries = Object.entries(v).map(
      ([key, val]) => `${escapeIdent(key)}: ${serializeValue(val)}`,
    );
    return `{ ${entries.join(', ')} }`;
  }

  // Fallback — unexpected type (class instance, Map, Set, …).
  return String(v);
}

// ---------------------------------------------------------------------------
// DEFAULT clause formatting
// ---------------------------------------------------------------------------

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
export function formatDefault(v: unknown): string {
  return serializeValue(v);
}

// ---------------------------------------------------------------------------
// SurrealQL template tag
// ---------------------------------------------------------------------------

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
export function surql(strings: TemplateStringsArray, ...values: unknown[]): RawSurql {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += serializeValue(values[i]);
    }
  }
  return raw(result);
}

// ---------------------------------------------------------------------------
// Permissions fragment
// ---------------------------------------------------------------------------

/**
 * The permission operation keys recognised by SurrealDB `DEFINE … PERMISSIONS`.
 */
const PERMISSION_OPS = ['select', 'create', 'update', 'delete'] as const;

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
export function serializePermissionsFragment(perms: {
  select?: string | boolean;
  create?: string | boolean;
  update?: string | boolean;
  delete?: string | boolean;
}): string {
  const clauses: string[] = [];

  for (const op of PERMISSION_OPS) {
    const val = perms[op];
    if (val === undefined) continue;

    if (val === true) {
      clauses.push(`FOR ${op} FULL`);
    } else if (val === false) {
      clauses.push(`FOR ${op} NONE`);
    } else {
      clauses.push(`FOR ${op} WHERE ${val}`);
    }
  }

  return clauses.join(' ');
}
