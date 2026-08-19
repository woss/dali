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
export declare class DaliOrmError extends Error {
    readonly context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Migration-related errors (applying, rolling back, loading migrations).
 */
export declare class MigrationError extends DaliOrmError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Connection/driver-related errors (connect, reconnect, disconnect failures).
 */
export declare class ConnectionError extends DaliOrmError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Query execution errors (invalid SQL, runtime query failures).
 */
export declare class QueryError extends DaliOrmError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Schema definition errors (invalid table/column/access definitions).
 */
export declare class SchemaError extends DaliOrmError {
    constructor(message: string, context?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map