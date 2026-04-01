import { BaseColumnBuilder } from './base.js';

export class ArrayColumnBuilder extends BaseColumnBuilder<ArrayColumnBuilder> {
  constructor(name: string) {
    super(name, 'array');
  }

  protected formatDefault(value: unknown): string {
    return JSON.stringify(value);
  }
}

export function array(name: string = ''): ArrayColumnBuilder {
  return new ArrayColumnBuilder(name);
}
