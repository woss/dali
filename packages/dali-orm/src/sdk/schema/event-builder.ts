// =============================================================================
// EventConfig
// =============================================================================

/**
 * Configuration object for a SurrealDB event definition.
 */
export interface EventConfig {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}

// =============================================================================
// EventBuilder — fluent builder for DEFINE EVENT
// =============================================================================

/**
 * Fluent builder for SurrealDB DEFINE EVENT statements.
 *
 * Uses immutable config pattern — each method copies config with spread.
 * Call `.build()` to get an `EventConfig`, `.toSQL()` for the SQL string.
 *
 * @example
 * ```ts
 * const event = defineEvent('on_user_update')
 *   .on('user')
 *   .when('$before OR $after')
 *   .then('UPDATE stats SET updated_at = time::now()')
 *   .comment('Track user changes')
 *   .build();
 * ```
 */
export type EventBuilder = ReturnType<typeof defineEvent>;

export function defineEvent(name: string) {
  if (!name) throw new Error('Event name is required');

  let config: {
    on?: string;
    when?: string;
    then?: string[];
    comment?: string;
    async?: boolean;
    retry?: number;
    maxdepth?: number;
  } = {};

  return {
    get name() {
      return name;
    },

    /** Set the table name (maps to ON TABLE clause) */
    on(tableName: string) {
      config = { ...config, on: tableName };
      return this;
    },

    /** Set the WHEN condition (e.g. '$before OR $after') */
    when(condition: string) {
      config = { ...config, when: condition };
      return this;
    },

    /** Add a THEN SQL statement (appends to internal array) */
    then(sql: string) {
      config = { ...config, then: [...(config.then ?? []), sql] };
      return this;
    },

    /** Optional comment for the event */
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },

    /** Mark event as ASYNC */
    async() {
      config = { ...config, async: true };
      return this;
    },

    /** Retry count for async events */
    retry(count: number) {
      config = { ...config, retry: count };
      return this;
    },

    /** Max recursion depth */
    maxdepth(depth: number) {
      config = { ...config, maxdepth: depth };
      return this;
    },

    /**
     * Return the EventConfig object.
     * Validates that required fields are set.
     */
    build(): EventConfig {
      const on = config.on;
      if (!on) throw new Error('Table name is required (use .on())');

      const when = config.when;
      if (!when) throw new Error('WHEN condition is required (use .when())');

      const then = config.then;
      if (!then || then.length === 0) {
        throw new Error('At least one THEN statement is required (use .then())');
      }
      return {
        name,
        on,
        when,
        then,
        comment: config.comment,
        async: config.async,
        retry: config.retry,
        maxdepth: config.maxdepth,
      };
    },

    /**
     * Generate the DEFINE EVENT SQL string from stored configuration.
     */
    toSQL(): string {
      const built = this.build();
      const parts = [`DEFINE EVENT IF NOT EXISTS ${built.name} ON TABLE ${built.on}`];

      parts.push(`WHEN (${built.when})`);
      parts.push(`THEN { ${built.then.join('; ')} }`);

      if (built.comment) parts.push(`COMMENT "${built.comment}"`);
      if (built.async) parts.push('ASYNC');
      if (built.retry) parts.push(`RETRY ${built.retry}`);
      if (built.maxdepth) parts.push(`MAXDEPTH ${built.maxdepth}`);

      return parts.join(' ');
    },
  };
}
