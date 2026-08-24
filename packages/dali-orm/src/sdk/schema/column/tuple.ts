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
export class TupleColumnBuilder extends BaseColumnBuilder<TupleColumnBuilder> {
  private _elements: ElementConfig[] = [];

  constructor(name: string, size: number) {
    super(name, 'tuple');
    this.config.size = size;
  }

  /** Formats the default value as JSON string. */
  protected formatDefault(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * Configure all tuple elements at once
   */
  elements(elementConfigs: ElementConfig[]): TupleColumnBuilder {
    this._elements = elementConfigs;
    return this;
  }

  /**
   * Configure a single element at the given index
   */
  element(
    index: number,
    type: SurrealColumnType,
    assert?: string,
  ): TupleColumnBuilder {
    while (this._elements.length <= index) {
      this._elements.push({ type: 'string' });
    }
    this._elements[index] = { type, assert };
    return this;
  }

  /**
   * Set an array-level assertion that must hold for all elements.
   * The expression is checked against each element using the $value variable.
   *
   * @example
   * // Assert all elements are bytes in range 0-255
   * tuple('data', 640).assertAll('$value IN 0..=255')
   */
  assertAll(expression: string): TupleColumnBuilder {
    this.config.arrayAssert = { type: 'all', expression };
    return this;
  }

  build(tableName?: string) {
    const mainDef = super.build(tableName);
    // Copy element config to the main definition
    mainDef.config.elements = this._elements;
    return mainDef;
  }
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
export function tuple(name: string, size: number): TupleColumnBuilder {
  return new TupleColumnBuilder(name, size);
}
