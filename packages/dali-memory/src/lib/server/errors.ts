/**
 * Dali-Memory Error Hierarchy
 *
 * Domain-specific errors for dali-memory operations.
 * All errors extend {@link DaliOrmError} from the core ORM package
 * and carry an optional context object for structured error data.
 *
 * @module
 */

import { DaliOrmError } from '@woss/dali-orm/core/errors';

/**
 * Error during memory CRUD operations (create, read, update, delete, search).
 *
 * @example
 * ```ts
 * throw new MemoryError('Memory not found', { memoryId: 'mem_123' });
 * ```
 */
export class MemoryError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'MemoryError';
  }
}

/**
 * Error during tag operations (create, attach to memory, detach, list).
 *
 * @example
 * ```ts
 * throw new TagError('Tag already exists', { tagName: 'important' });
 * ```
 */
export class TagError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'TagError';
  }
}

/**
 * Error during workspace operations (create, delete, list).
 *
 * @example
 * ```ts
 * throw new WorkspaceError('Workspace name already taken', { name: 'my-workspace' });
 * ```
 */
export class WorkspaceError extends DaliOrmError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = 'WorkspaceError';
  }
}
