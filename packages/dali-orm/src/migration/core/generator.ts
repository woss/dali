/**
 * SurrealQL Generator for Schema Definitions
 *
 * Converts TableDefinition and ColumnDefinition objects into SurrealQL statements.
 */

import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { IndexDefinition, TableConfig, TableDefinition } from '../../sdk/table.js';
import type { SurrealAccess, SurrealEvent, SurrealFunction, SurrealView } from '../ddl/ddl.js';
import { getSurrealQLType } from '../ddl/types.js';
import { formatDefaultValue, validateChangefeed } from '../utils/format.js';

/**
 * SurrealQL Generator for Schema Definitions
 *
 * Converts schema definitions into SurrealQL migration statements.
 */
export class SurrealQLGenerator {
  /**
   * Generate DEFINE TABLE statement
   */
  generateTableDefinition(table: TableDefinition): string {
    // Parse Don't Validate: validate at boundary
    validateChangefeed((table.config as TableConfig).changefeed);

    const parts: string[] = [`DEFINE TABLE IF NOT EXISTS ${table.name}`];

    // SCHEMAFULL or SCHEMALESS
    if (table.config.schema === 'less') {
      parts.push('SCHEMALESS');
    } else {
      parts.push('SCHEMAFULL');
    }

    // TYPE RELATION for edge tables
    if (table.config.type === 'relation') {
      parts.push(`TYPE RELATION`);
      if (table.config.in) {
        const inVal = Array.isArray(table.config.in) ? table.config.in.join(', ') : table.config.in;
        parts.push(`IN ${inVal}`);
      }
      if (table.config.out) {
        const outVal = Array.isArray(table.config.out)
          ? table.config.out.join(', ')
          : table.config.out;
        parts.push(`OUT ${outVal}`);
      }
    }

    // PERMISSIONS
    if (table.config.permissions) {
      const perms = this.generatePermissions(table.config.permissions);
      if (perms) {
        parts.push(`PERMISSIONS ${perms}`);
      }
    }

    // CHANGEFEED
    if (table.config.changefeed) {
      parts.push(`CHANGEFEED ${table.config.changefeed}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate DEFINE FIELD statement
   * Handles tuple types with element sub-fields
   * Returns single string (joined if multiple statements for tuple)
   */
  generateFieldDefinition(column: ColumnDefinition): string {
    // SurrealDB automatically creates the 'id' field, no need to define it
    if (column.name === 'id') {
      return '';
    }

    const table = column.tableName ?? '';
    if (!table) {
      throw new Error(`Column ${column.name} is missing tableName`);
    }

    // Handle tuple types - emit main field + element fields as single joined statement
    if (column.config.type === 'tuple' && column.config.size && column.config.elements) {
      return this.generateTupleFieldDefinition(column, table).join('; ');
    }

    // Regular single field
    return this.generateSingleFieldDefinition(column, table);
  }

  /**
   * Generate field redefine statement that overwrites existing field.
   * Uses DEFINE FIELD (without IF NOT EXISTS) so SurrealDB updates the field definition.
   */
  generateFieldRedefine(column: ColumnDefinition): string {
    // SurrealDB automatically creates the 'id' field, no need to alter it
    if (column.name === 'id') {
      return '';
    }

    const table = column.tableName ?? '';
    if (!table) {
      throw new Error(`Column ${column.name} is missing tableName`);
    }

    // Handle tuple types - emit main field + element fields
    if (column.config.type === 'tuple' && column.config.size && column.config.elements) {
      return this.generateTupleFieldDefinition(column, table).join('; ');
    }

    // Regular single field - same as generateSingleFieldDefinition but WITHOUT IF NOT EXISTS
    return this.generateSingleFieldRedefine(column, table);
  }

  /**
   * Generate multiple field definitions (for internal use with tuples)
   * Returns array of SQL statements
   */
  generateFieldDefinitions(column: ColumnDefinition): string[] {
    // SurrealDB automatically creates the 'id' field, no need to define it
    if (column.name === 'id') {
      return [''];
    }

    const table = column.tableName ?? '';
    if (!table) {
      throw new Error(`Column ${column.name} is missing tableName`);
    }

    // Handle tuple types - emit main field + element fields
    if (column.config.type === 'tuple' && column.config.size && column.config.elements) {
      return this.generateTupleFieldDefinition(column, table);
    }

    // Regular single field
    return [this.generateSingleFieldDefinition(column, table)];
  }

  /**
   * Generate tuple field with element sub-fields
   */
  private generateTupleFieldDefinition(column: ColumnDefinition, tableName: string): string[] {
    const sqls: string[] = [];

    // Get element type from first element or default to 'any'
    const elementType = column.config.elements?.[0]?.type ?? 'any';

    // Main array field
    let mainSql = `DEFINE FIELD IF NOT EXISTS ${column.name} ON TABLE ${tableName} TYPE array<${elementType}, ${column.config.size}>`;

    // Add array-level assertion if present
    if (column.config.arrayAssert) {
      mainSql += ` ASSERT $value.${column.config.arrayAssert.type}(|$value| ${column.config.arrayAssert.expression})`;
    }

    // DEFAULT value
    if (column.config.defaultRaw !== undefined) {
      mainSql += ` DEFAULT ${column.config.defaultRaw}`;
    } else if (column.config.default !== undefined) {
      mainSql += ` DEFAULT ${formatDefaultValue(column.config.default)}`;
    }

    sqls.push(mainSql);

    // Element fields
    if (column.config.elements) {
      for (let i = 0; i < column.config.elements.length; i++) {
        const element = column.config.elements[i];
        let elementSql = `DEFINE FIELD IF NOT EXISTS ${column.name}[${i}] ON TABLE ${tableName} TYPE ${getSurrealQLType(element.type)}`;

        if (element.assert) {
          elementSql += ` ASSERT ${element.assert}`;
        }

        sqls.push(elementSql);
      }
    }

    return sqls;
  }

  /**
   * Generate single (non-tuple) field definition
   */
  private generateSingleFieldDefinition(column: ColumnDefinition, tableName: string): string {
    const parts: string[] = [`DEFINE FIELD IF NOT EXISTS ${column.name} ON TABLE ${tableName}`];

    // Type - use option<T> for optional columns
    const baseType = getSurrealQLType(column.config.type);
    // For record type, append the linked table name if available
    let typeStr = baseType;
    if (baseType === 'record' && (column.config.recordTable || column.config.linksTo)) {
      typeStr = `record<${column.config.recordTable || column.config.linksTo}>`;
    }

    // FLEXIBLE only pairs with plain TYPE object, not option<object>
    if (column.config.optional && !(column.config.flexible && baseType === 'object')) {
      typeStr = `option<${typeStr}>`;
    }
    parts.push(`TYPE ${typeStr}`);

    // FLEXIBLE must be specified after TYPE in SurrealDB
    if (column.config.flexible) {
      parts.push('FLEXIBLE');
    }

    // READONLY
    if (column.config.readonly) {
      parts.push('READONLY');
    }

    // DEFAULT value
    if (column.config.defaultRaw !== undefined) {
      parts.push(`DEFAULT ${column.config.defaultRaw}`);
    } else if (column.config.default !== undefined) {
      parts.push(`DEFAULT ${formatDefaultValue(column.config.default)}`);
    }

    // ASSERT for validation (not just 'assert', but any validation expression)
    if (column.config.assert) {
      parts.push(`ASSERT ${column.config.assert}`);
    }

    // PERMISSIONS (column permissions are a direct string expression)
    if (column.config.permissions) {
      parts.push(`PERMISSIONS ${column.config.permissions}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate single (non-tuple) field redefine statement (overwrites existing field definition)
   */
  private generateSingleFieldRedefine(column: ColumnDefinition, tableName: string): string {
    const parts: string[] = [`DEFINE FIELD OVERWRITE ${column.name} ON TABLE ${tableName}`];

    // Type - use option<T> for optional columns
    const baseType = getSurrealQLType(column.config.type);
    // For record type, append the linked table name if available
    let typeStr = baseType;
    if (baseType === 'record' && (column.config.recordTable || column.config.linksTo)) {
      typeStr = `record<${column.config.recordTable || column.config.linksTo}>`;
    }

    // FLEXIBLE only pairs with plain TYPE object, not option<object>
    if (column.config.optional && !(column.config.flexible && baseType === 'object')) {
      typeStr = `option<${typeStr}>`;
    }
    parts.push(`TYPE ${typeStr}`);

    // FLEXIBLE must be specified after TYPE in SurrealDB
    if (column.config.flexible) {
      parts.push('FLEXIBLE');
    }

    // READONLY
    if (column.config.readonly) {
      parts.push('READONLY');
    }

    // DEFAULT value
    if (column.config.defaultRaw !== undefined) {
      parts.push(`DEFAULT ${column.config.defaultRaw}`);
    } else if (column.config.default !== undefined) {
      parts.push(`DEFAULT ${formatDefaultValue(column.config.default)}`);
    }

    // ASSERT for validation
    if (column.config.assert) {
      parts.push(`ASSERT ${column.config.assert}`);
    }

    // PERMISSIONS (column permissions are a direct string expression)
    if (column.config.permissions) {
      parts.push(`PERMISSIONS ${column.config.permissions}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate DEFINE INDEX statement
   */
  generateIndexDefinition(index: IndexDefinition, tableName: string): string {
    if (!tableName) {
      throw new Error('Table name is required for index definition');
    }
    if (!index.name) {
      throw new Error('Index name is required');
    }
    if (!index.fields || index.fields.length === 0) {
      throw new Error(`Index ${index.name} must have at least one field`);
    }

    const parts: string[] = [
      `DEFINE INDEX ${index.name} ON TABLE ${tableName} COLUMNS ${index.fields.join(', ')}`,
    ];

    // Index type
    if (index.type === 'unique') {
      parts.push('UNIQUE');
    } else if (index.type === 'fulltext') {
      parts.push('FULLTEXT');
      if (index.analyzer) {
        parts.push(`ANALYZER ${index.analyzer}`);
      }
    } else if (index.type === 'hnsw') {
      parts.push('HNSW');
      if (index.dimension) {
        parts.push(`DIMENSION ${index.dimension}`);
      }
      if (index.vectorType) {
        // Map internal vectorType names to SurrealDB's expected format
        // SurrealDB supports: F64, F32, I64, I32, I16 (docs.surrealdb.com)
        const VECTOR_TYPE_TO_SQL: Record<string, string> = {
          float32: 'F32',
          float64: 'F64',
          float: 'F64', // deprecated alias — F64 is the HNSW default
        };
        const sqlType = VECTOR_TYPE_TO_SQL[index.vectorType] ?? index.vectorType;
        parts.push(`TYPE ${sqlType}`);
      }
      if (index.distance) {
        parts.push(`DIST ${index.distance}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Generate REMOVE TABLE statement
   */
  generateRemoveTable(tableName: string): string {
    if (!tableName) {
      throw new Error('Table name is required for REMOVE TABLE');
    }
    return `REMOVE TABLE ${tableName}`;
  }

  /**
   * Generate REMOVE FIELD statement
   */
  generateRemoveField(tableName: string, fieldName: string): string {
    if (!tableName) {
      throw new Error('Table name is required for REMOVE FIELD');
    }
    if (!fieldName) {
      throw new Error('Field name is required for REMOVE FIELD');
    }
    return `REMOVE FIELD ${fieldName} ON TABLE ${tableName}`;
  }

  /**
   * Generate REMOVE INDEX statement
   */
  generateRemoveIndex(indexName: string, tableName: string): string {
    if (!indexName) {
      throw new Error('Index name is required for REMOVE INDEX');
    }
    if (!tableName) {
      throw new Error('Table name is required for REMOVE INDEX');
    }
    return `REMOVE INDEX ${indexName} ON TABLE ${tableName}`;
  }

  /**
   * Generate REMOVE ACCESS statement
   */
  generateRemoveAccess(accessName: string): string {
    if (!accessName) {
      throw new Error('Access name is required for REMOVE ACCESS');
    }
    return `REMOVE ACCESS IF EXISTS ${accessName} ON DATABASE`;
  }

  /**
   * Generate DEFINE ACCESS statement from access definition
   *
   * Follows the same pattern as accessToSQL() in sdk/schema.ts
   * but supports configurable level (ROOT/NAMESPACE/DATABASE).
   *
   * @param access - Access definition with name, type, level, and optional auth/JWT fields
   * @returns SurrealQL DEFINE ACCESS statement
   */
  generateAccessDefinition(access: {
    name: string;
    type: string;
    level?: string;
    table?: string;
    signup?: string;
    signin?: string;
    identifier?: string;
    algorithm?: string;
    key?: string;
    issuer?: string;
    duration?: string;
    tokenDuration?: string;
  }): string {
    if (!access.name) {
      throw new Error('Access name is required for DEFINE ACCESS');
    }
    if (!access.type) {
      throw new Error('Access type is required for DEFINE ACCESS');
    }

    const level = access.level ?? 'DATABASE';
    const parts: string[] = [`DEFINE ACCESS ${access.name} ON ${level} TYPE ${access.type}`];

    if (access.signup) {
      parts.push(`SIGNUP (${access.signup})`);
    }

    if (access.signin) {
      parts.push(`SIGNIN (${access.signin})`);
    }

    if (access.algorithm) {
      parts.push(`ALGORITHM ${access.algorithm}`);
    }

    if (access.key) {
      parts.push(`KEY "${access.key}"`);
    }

    if (access.issuer) {
      parts.push(`ISSUER ${access.issuer}`);
    }

    if (access.duration || access.tokenDuration) {
      const durationParts: string[] = [];
      if (access.tokenDuration) {
        durationParts.push(`FOR TOKEN ${access.tokenDuration}`);
      }
      if (access.duration) {
        durationParts.push(`FOR SESSION ${access.duration}`);
      }
      parts.push(`DURATION ${durationParts.join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate access migration SQL for a given direction
   *
   * For 'up': generates DEFINE ACCESS statement
   * For 'down': generates REMOVE ACCESS IF EXISTS statement
   *
   * @param access - Structured access definition
   * @param direction - Migration direction: 'up' to create, 'down' to remove
   * @returns Single SurrealQL statement
   */
  generateAccessMigration(access: SurrealAccess, direction: 'up' | 'down'): string {
    if (!access.name) {
      throw new Error('Access name is required for migration');
    }

    if (direction === 'down') {
      return this.generateRemoveAccess(access.name);
    }

    return this.generateAccessDefinition(access);
  }

  /**
   * Generate DEFINE EVENT statement from event definition
   *
   * @param event - Event definition with name, what, when, then, and optional async/retry/maxdepth
   * @returns SurrealQL DEFINE EVENT statement
   */
  generateEventDefinition(event: {
    name: string;
    what: string;
    when: string;
    then: string[];
    comment?: string;
    async?: boolean;
    retry?: number;
    maxdepth?: number;
  }): string {
    if (!event.name) {
      throw new Error('Event name is required for DEFINE EVENT');
    }
    if (!event.what) {
      throw new Error('Event table (what) is required for DEFINE EVENT');
    }
    if (!event.when) {
      throw new Error('Event condition (when) is required for DEFINE EVENT');
    }
    if (!event.then || event.then.length === 0) {
      throw new Error('Event action (then) is required for DEFINE EVENT');
    }

    const parts: string[] = [
      `DEFINE EVENT IF NOT EXISTS ${event.name} ON TABLE ${event.what} WHEN (${event.when}) THEN { ${event.then.join('; ')} }`,
    ];

    if (event.comment) {
      parts.push(`COMMENT "${event.comment}"`);
    }

    if (event.async) {
      parts.push('ASYNC');
    }

    if (event.retry !== undefined) {
      parts.push(`RETRY ${event.retry}`);
    }

    if (event.maxdepth !== undefined) {
      parts.push(`MAXDEPTH ${event.maxdepth}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate REMOVE EVENT statement
   */
  generateRemoveEvent(eventName: string, tableName: string): string {
    if (!eventName) {
      throw new Error('Event name is required for REMOVE EVENT');
    }
    if (!tableName) {
      throw new Error('Table name is required for REMOVE EVENT');
    }
    return `REMOVE EVENT IF EXISTS ${eventName} ON TABLE ${tableName}`;
  }

  /**
   * Generate event migration SQL for a given direction
   *
   * For 'up': generates DEFINE EVENT statement
   * For 'down': generates REMOVE EVENT IF EXISTS statement
   *
   * @param event - Structured event definition (SurrealEvent type)
   * @param direction - Migration direction: 'up' to create, 'down' to remove
   * @returns Single SurrealQL statement
   */
  generateEventMigration(event: SurrealEvent, direction: 'up' | 'down'): string {
    if (!event.name) {
      throw new Error('Event name is required for migration');
    }

    if (direction === 'down') {
      return this.generateRemoveEvent(event.name, event.what);
    }

    return this.generateEventDefinition(event);
  }

  /**
   * Generate DEFINE FUNCTION statement
   */
  generateFunctionDefinition(func: {
    name: string;
    args?: string[];
    body: string;
    comment?: string;
    permissions?: string;
  }): string {
    if (!func.name) {
      throw new Error('Function name is required for DEFINE FUNCTION');
    }
    if (!func.body) {
      throw new Error('Function body is required for DEFINE FUNCTION');
    }

    const parts: string[] = [`DEFINE FUNCTION IF NOT EXISTS ${func.name}`];

    if (func.args && func.args.length > 0) {
      parts.push(`(${func.args.join(', ')})`);
    }

    parts.push(`{ ${func.body} }`);

    if (func.comment) {
      parts.push(`COMMENT "${func.comment}"`);
    }

    if (func.permissions) {
      parts.push(`PERMISSIONS ${func.permissions}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate REMOVE FUNCTION statement
   */
  generateRemoveFunction(funcName: string): string {
    if (!funcName) {
      throw new Error('Function name is required for REMOVE FUNCTION');
    }
    return `REMOVE FUNCTION IF EXISTS ${funcName}`;
  }

  /**
   * Generate function migration SQL for a given direction
   */
  generateFunctionMigration(func: SurrealFunction, direction: 'up' | 'down'): string {
    if (!func.name) {
      throw new Error('Function name is required for migration');
    }

    if (direction === 'down') {
      return this.generateRemoveFunction(func.name);
    }

    return this.generateFunctionDefinition(func);
  }

  /**
   * Generate DEFINE VIEW statement
   */
  generateViewDefinition(view: { name: string; query: string; comment?: string }): string {
    if (!view.name) {
      throw new Error('View name is required for DEFINE VIEW');
    }
    if (!view.query) {
      throw new Error('View query is required for DEFINE VIEW');
    }

    const parts: string[] = [`DEFINE VIEW IF NOT EXISTS ${view.name} AS ${view.query}`];

    if (view.comment) {
      parts.push(`COMMENT "${view.comment}"`);
    }

    return parts.join(' ');
  }

  /**
   * Generate REMOVE VIEW statement
   */
  generateRemoveView(viewName: string): string {
    if (!viewName) {
      throw new Error('View name is required for REMOVE VIEW');
    }
    return `REMOVE VIEW IF EXISTS ${viewName}`;
  }

  /**
   * Generate view migration SQL for a given direction
   */
  generateViewMigration(view: SurrealView, direction: 'up' | 'down'): string {
    if (!view.name) {
      throw new Error('View name is required for migration');
    }

    if (direction === 'down') {
      return this.generateRemoveView(view.name);
    }

    return this.generateViewDefinition(view);
  }

  /**
   * Generate ALTER FIELD TYPE statement
   */
  generateAlterFieldType(tableName: string, fieldName: string, newType: string): string {
    if (!tableName) {
      throw new Error('Table name is required for ALTER FIELD TYPE');
    }
    if (!fieldName) {
      throw new Error('Field name is required for ALTER FIELD TYPE');
    }
    const typeStr = getSurrealQLType(newType);
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} TYPE ${typeStr}`;
  }

  /**
   * Generate ALTER TABLE PERMISSIONS statement
   */
  generateAlterTablePermissions(
    tableName: string,
    permissions: TableConfig['permissions'],
  ): string {
    if (!tableName) {
      throw new Error('Table name is required for ALTER TABLE PERMISSIONS');
    }
    if (!permissions) {
      return '';
    }

    const parts: string[] = [];

    if (permissions.select) parts.push(`FOR select ${permissions.select}`);
    if (permissions.create) parts.push(`FOR create ${permissions.create}`);
    if (permissions.update) parts.push(`FOR update ${permissions.update}`);
    if (permissions.delete) parts.push(`FOR delete ${permissions.delete}`);

    if (parts.length === 0) {
      return '';
    }

    return `ALTER TABLE ${tableName} PERMISSIONS ${parts.join(' ')}`;
  }

  /**
   * Generate ALTER FIELD PERMISSIONS statement
   */
  generateAlterFieldPermissions(tableName: string, fieldName: string, permissions: string): string {
    if (!tableName) {
      throw new Error('Table name is required for ALTER FIELD PERMISSIONS');
    }
    if (!fieldName) {
      throw new Error('Field name is required for ALTER FIELD PERMISSIONS');
    }
    if (!permissions) {
      return '';
    }
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} PERMISSIONS ${permissions}`;
  }

  /**
   * Generate ALTER FIELD DEFAULT statement
   *
   * @param defaultRaw - Raw SurrealDB expression (e.g., `crypto::blake3(content)`), takes precedence over defaultValue
   * @param defaultValue - Formatted default value (string/number/boolean), passed through formatDefaultValue
   */
  generateAlterFieldDefault(
    tableName: string,
    fieldName: string,
    defaultValue?: unknown,
    defaultRaw?: string,
  ): string {
    if (!tableName) {
      throw new Error('Table name is required for ALTER FIELD DEFAULT');
    }
    if (!fieldName) {
      throw new Error('Field name is required for ALTER FIELD DEFAULT');
    }
    if (defaultRaw !== undefined) {
      return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT ${defaultRaw}`;
    }
    if (defaultValue === undefined) {
      return '';
    }
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT ${formatDefaultValue(defaultValue)}`;
  }

  /**
   * Generate complete migration SQL for a table
   */
  generateTableMigration(table: TableDefinition, direction: 'up' | 'down' = 'up'): string[] {
    // Early exit for down direction
    if (direction === 'down') {
      return [this.generateRemoveTable(table.name)];
    }

    const statements: string[] = [];

    // Table definition
    statements.push(this.generateTableDefinition(table));

    // Field definitions (use array-returning version for tuple support)
    for (const column of table.columns) {
      const fieldSqls = this.generateFieldDefinitions(column);
      statements.push(...fieldSqls);
    }

    // Index definitions
    if (table.config.indexes) {
      for (const index of table.config.indexes) {
        statements.push(this.generateIndexDefinition(index, table.name));
      }
    }

    // Filter out empty statements before returning (e.g., from id field which returns empty string)
    return statements.filter((s) => s.trim() !== '');
  }

  /**
   * Generate migration from multiple tables
   */
  generateMigration(tables: TableDefinition[], direction: 'up' | 'down' = 'up'): string[] {
    const statements: string[] = [];

    for (const table of tables) {
      statements.push(...this.generateTableMigration(table, direction));
    }

    // Filter out empty statements (e.g., from id field which returns empty string)
    return statements.filter((s) => s.trim() !== '');
  }

  /**
   * Generate a complete migration file structure
   *
   * This creates both 'up' (apply) and 'down' (rollback) SQL statements
   * from table definitions, suitable for writing to a migration file.
   */
  generateMigrationFile(
    tables: TableDefinition[],
    _version: string,
    _name: string,
  ): { up: string[]; down: string[] } {
    // Generate up migration (apply changes)
    const upStatements = this.generateMigration(tables, 'up');
    const up = upStatements.filter((s) => s.trim() !== '');

    // Generate down migration (rollback)
    const downStatements = this.generateMigration(tables, 'down');
    const down = downStatements.filter((s) => s.trim() !== '');

    return { up, down };
  }

  // Private helper methods

  /**
   * Generate PERMISSIONS clause from permissions object
   */
  private generatePermissions(perms: TableConfig['permissions']): string {
    if (!perms) return '';

    const parts: string[] = [];

    if (perms.select) parts.push(`FOR select ${perms.select}`);
    if (perms.create) parts.push(`FOR create ${perms.create}`);
    if (perms.update) parts.push(`FOR update ${perms.update}`);
    if (perms.delete) parts.push(`FOR delete ${perms.delete}`);

    return parts.join(' ');
  }
}
