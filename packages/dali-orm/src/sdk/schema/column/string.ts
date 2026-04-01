import { BaseColumnBuilder } from './base.js';

export class StringColumnBuilder extends BaseColumnBuilder<StringColumnBuilder> {
  constructor(name: string) {
    super(name, 'string');
  }

  protected formatDefault(value: unknown): string {
    return String(value); // Quotes added by generator
  }
}

export function string(name = ''): StringColumnBuilder {
  return new StringColumnBuilder(name);
}
