/**
 * SurrealQL Generator for Schema Definitions
 *
 * Converts TableDefinition and ColumnDefinition objects into SurrealQL statements.
 */

import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type {
  AnalyzerDefinition,
  IndexDefinition,
  TableConfig,
  TableDefinition,
} from '../../sdk/table.js';
import type {
  SurrealAccess,
  SurrealEvent,
  SurrealFunction,
  SurrealSequence,
  SurrealView,
} from '../ddl/ddl.js';
import { getSurrealQLType } from '../ddl/types.js';
import { formatDefaultValue, validateChangefeed } from '../utils/format.js';
import {
  generateRemoveAccess,
  generateNamespaceDefinition,
  generateRemoveNamespace,
  generateDatabaseDefinition,
  generateRemoveDatabase,
  generateAccessDefinition,
  generateAccessMigration,
  generateEventDefinition,
  generateRemoveEvent,
  generateEventMigration,
  generateFunctionDefinition,
  generateRemoveFunction,
  generateFunctionMigration,
  generateViewDefinition,
  generateRemoveView,
  generateViewMigration,
  generateSequenceDefinition,
  generateRemoveSequence,
  generateAlterFieldType,
  generateAlterTablePermissions,
  generateAlterFieldPermissions,
  generateAlterFieldDefault,
  generateAnalyzerDefinition,
  generateRemoveAnalyzer,
} from './generator-ddl.js';

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

    // defaultRaw: when set, passes raw() SQL expression to formatDefaultValue
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

    // REFERENCE ON DELETE for record fields
    if (column.config.onDelete) {
      parts.push(`REFERENCE ON DELETE ${column.config.onDelete}`);
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

    // REFERENCE ON DELETE for record fields
    if (column.config.onDelete) {
      parts.push(`REFERENCE ON DELETE ${column.config.onDelete}`);
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
    return generateRemoveAccess(accessName);
  }

  /**
   * Generate DEFINE NAMESPACE statement
   *
   * SurrealQL: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
   */
  generateNamespaceDefinition(
    name: string,
    options?: {
      ifNotExists?: boolean;
      comment?: string;
    },
  ): string {
    return generateNamespaceDefinition(name, options);
  }

  /**
   * Generate REMOVE NAMESPACE statement
   *
   * SurrealQL: REMOVE NAMESPACE [IF EXISTS] <name>
   */
  generateRemoveNamespace(name: string, ifExists?: boolean): string {
    return generateRemoveNamespace(name, ifExists);
  }

  /**
   * Generate DEFINE DATABASE statement
   *
   * SurrealQL: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
   */
  generateDatabaseDefinition(
    name: string,
    options?: {
      ifNotExists?: boolean;
      comment?: string;
    },
  ): string {
    return generateDatabaseDefinition(name, options);
  }

  /**
   * Generate REMOVE DATABASE statement
   *
   * SurrealQL: REMOVE DATABASE [IF EXISTS] <name>
   */
  generateRemoveDatabase(name: string, ifExists?: boolean): string {
    return generateRemoveDatabase(name, ifExists);
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
    return generateAccessDefinition(access);
  }

  /**
   * Generate access migration SQL
   *
   * Generates DEFINE ACCESS statement
   *
   * @param access - Structured access definition
   * @returns Single SurrealQL statement
   */
  generateAccessMigration(access: SurrealAccess): string {
    return generateAccessMigration(access);
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
    return generateEventDefinition(event);
  }

  /**
   * Generate REMOVE EVENT statement
   */
  generateRemoveEvent(eventName: string, tableName: string): string {
    return generateRemoveEvent(eventName, tableName);
  }

  /**
   * Generate event migration SQL
   *
   * Generates DEFINE EVENT statement
   *
   * @param event - Structured event definition (SurrealEvent type)
   * @returns Single SurrealQL statement
   */
  generateEventMigration(event: SurrealEvent): string {
    return generateEventMigration(event);
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
    return generateFunctionDefinition(func);
  }

  /**
   * Generate REMOVE FUNCTION statement
   */
  generateRemoveFunction(funcName: string): string {
    return generateRemoveFunction(funcName);
  }

  /**
   * Generate function migration SQL
   */
  generateFunctionMigration(func: SurrealFunction): string {
    return generateFunctionMigration(func);
  }

  /**
   * Generate DEFINE VIEW statement
   */
  generateViewDefinition(view: { name: string; query: string; comment?: string }): string {
    return generateViewDefinition(view);
  }

  /**
   * Generate REMOVE VIEW statement
   */
  generateRemoveView(viewName: string): string {
    return generateRemoveView(viewName);
  }

  /**
   * Generate view migration SQL
   */
  generateViewMigration(view: SurrealView): string {
    return generateViewMigration(view);
  }

  /**
   * Generate DEFINE SEQUENCE statement
   *
   * SurrealQL: DEFINE SEQUENCE [IF NOT EXISTS] <name> [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE] [COMMENT '<str>']
   */
  generateSequenceDefinition(seq: SurrealSequence): string {
    return generateSequenceDefinition(seq);
  }

  /**
   * Generate REMOVE SEQUENCE statement
   *
   * SurrealQL: REMOVE SEQUENCE [IF EXISTS] <name>
   */
  generateRemoveSequence(seqName: string, ifExists?: boolean): string {
    return generateRemoveSequence(seqName, ifExists);
  }

  /**
   * Generate ALTER FIELD TYPE statement
   */
  generateAlterFieldType(tableName: string, fieldName: string, newType: string): string {
    return generateAlterFieldType(tableName, fieldName, newType);
  }

  /**
   * Generate ALTER TABLE PERMISSIONS statement
   */
  generateAlterTablePermissions(
    tableName: string,
    permissions: TableConfig['permissions'],
  ): string {
    return generateAlterTablePermissions(tableName, permissions);
  }

  /**
   * Generate ALTER FIELD PERMISSIONS statement
   */
  generateAlterFieldPermissions(tableName: string, fieldName: string, permissions: string): string {
    return generateAlterFieldPermissions(tableName, fieldName, permissions);
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
    return generateAlterFieldDefault(tableName, fieldName, defaultValue, defaultRaw);
  }

  /**
   * Generate complete migration SQL for a table
   */
  generateTableMigration(table: TableDefinition): string[] {
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
   * Generate DEFINE ANALYZER statement
   *
   * SurrealDB 3.0 syntax:
   *   DEFINE ANALYZER [IF NOT EXISTS] @name [TOKENIZERS @t1 [,@tN]] [FILTERS @f1 [,@fN]]
   */
  generateAnalyzerDefinition(analyzer: AnalyzerDefinition): string {
    return generateAnalyzerDefinition(analyzer);
  }

  /**
   * Generate REMOVE ANALYZER statement
   */
  generateRemoveAnalyzer(analyzerName: string): string {
    return generateRemoveAnalyzer(analyzerName);
  }

  /**
   * Generate migration from multiple tables
   */
  generateMigration(tables: TableDefinition[], analyzers?: AnalyzerDefinition[]): string[] {
    const statements: string[] = [];

    // Emit analyzers before tables
    if (analyzers) {
      for (const analyzer of analyzers) {
        statements.push(this.generateAnalyzerDefinition(analyzer));
      }
    }
    for (const table of tables) {
      statements.push(...this.generateTableMigration(table));
    }

    // Filter out empty statements (e.g., from id field which returns empty string)
    return statements.filter((s) => s.trim() !== '');
  }

  /**
   * Generate a complete migration file structure
   *
   * This creates 'up' (apply) SQL statements
   * from table definitions, suitable for writing to a migration file.
   */
  generateMigrationFile(
    tables: TableDefinition[],
    _version: string,
    _name: string,
    analyzers?: AnalyzerDefinition[],
  ): { up: string[] } {
    const upStatements = this.generateMigration(tables, analyzers);
    const up = upStatements.filter((s) => s.trim() !== '');

    return { up };
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
