import { BaseColumnBuilder } from './base.js';

export class BoolColumnBuilder extends BaseColumnBuilder<BoolColumnBuilder> {
  constructor(name: string) {
    super(name, 'bool');
  }

  protected formatDefault(value: unknown): string {
    // Return unquoted SurrealQL boolean literals
    return value ? 'true' : 'false';
  }
}

export function bool(name: string = ''): BoolColumnBuilder {
  return new BoolColumnBuilder(name);
}
