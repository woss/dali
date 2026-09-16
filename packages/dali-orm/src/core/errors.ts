/**
 * DaliORM Error Hierarchy
 *
 * All DaliORM errors extend the base {@link DaliOrmError} class.
 * Each subclass carries an optional {@link DaliOrmError.context} object
 * for structured error data (e.g. migration name, expected/actual values).
 *
 * @module
 */

/**
 * Base error class for all DaliORM errors.
 * Carries an optional context object for structured error data.
 */
export class DaliOrmError extends Error {
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DaliOrmError';
    this.context = context;
  }
}

/**
 * Migration-related errors (applying, rolling back, loading migrations).
 */
export class MigrationError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'MigrationError';
  }
}

/**
 * Connection/driver-related errors (connect, reconnect, disconnect failures).
 */
export class ConnectionError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'ConnectionError';
  }
}

/**
 * Query execution errors (invalid SQL, runtime query failures).
 */
export class QueryError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'QueryError';
  }
}

/**
 * Schema definition errors (invalid table/column/access definitions).
 */
export class SchemaError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'SchemaError';
  }
}
