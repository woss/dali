import { BaseColumnBuilder } from './base.js';

export class IntColumnBuilder extends BaseColumnBuilder<IntColumnBuilder> {
  constructor(name: string) {
    super(name, 'int');
  }
}

export function int(name = ''): IntColumnBuilder {
  return new IntColumnBuilder(name);
}
