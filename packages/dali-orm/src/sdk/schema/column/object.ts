import { BaseColumnBuilder } from './base.js';

export class ObjectColumnBuilder extends BaseColumnBuilder<ObjectColumnBuilder> {
  constructor(name: string) {
    super(name, 'object');
  }

  protected formatDefault(value: unknown): string {
    return JSON.stringify(value);
  }
}

export function object(name: string): ObjectColumnBuilder {
  return new ObjectColumnBuilder(name);
}
