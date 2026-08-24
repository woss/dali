import { BaseColumnBuilder } from './base.js';
import type { ElementConfig, SurrealColumnType } from './types.js';
/**
 * Builder for fixed-size tuple arrays with element assertions.
 *
 * @example
 * tuple('rgb', 3).elements([
 *   { type: 'int', assert: '$value IN 0..=255' },
 *   { type: 'int', assert: '$value IN 0..=255' },
 *   { type: 'int', assert: '$value IN 0..=255' },
 * ])
 */
export declare class TupleColumnBuilder extends BaseColumnBuilder<TupleColumnBuilder> {
  private _elements;
  constructor(name: string, size: number);
  /** Formats the default value as JSON string. */
  protected formatDefault(value: unknown): string;
  /**
   * Configure all tuple elements at once
   */
  elements(elementConfigs: ElementConfig[]): TupleColumnBuilder;
  /**
   * Configure a single element at the given index
   */
  element(
    index: number,
    type: SurrealColumnType,
    assert?: string,
  ): TupleColumnBuilder;
  /**
   * Set an array-level assertion that must hold for all elements.
   * The expression is checked against each element using the $value variable.
   *
   * @example
   * // Assert all elements are bytes in range 0-255
   * tuple('data', 640).assertAll('$value IN 0..=255')
   */
  assertAll(expression: string): TupleColumnBuilder;
  build(tableName?: string): import('./types.js').ColumnDefinition;
}
/**
 * Create a fixed-size tuple array column
 *
 * @example
 * // RGB color (3 integers 0-255)
 * tuple('rgb', 3).elements([
 *   { type: 'int', assert: '$value IN 0..=255' },
 *   { type: 'int', assert: '$value IN 0..=255' },
 *   { type: 'int', assert: '$value IN 0..=255' },
 * ])
 *
 * // 2D coordinates
 * tuple('position', 2).elements([
 *   { type: 'float' },
 *   { type: 'float' },
 * ])
 */
export declare function tuple(name: string, size: number): TupleColumnBuilder;
//# sourceMappingURL=tuple.d.ts.map
