import { BaseColumnBuilder } from './base.js';

export class IntColumnBuilder extends BaseColumnBuilder<IntColumnBuilder> {
  constructor(name: string) {
    super(name, 'int');
  }

  protected formatDefault(value: unknown): string {
    return String(Number(value));
  }
}

export function int(name = ''): IntColumnBuilder {
  return new IntColumnBuilder(name);
}
