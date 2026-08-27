import { BaseColumnBuilder } from './base.js';

export class ArrayColumnBuilder extends BaseColumnBuilder<ArrayColumnBuilder> {
  constructor(name: string) {
    super(name, 'array');
  }
}

export function array(name: string = ''): ArrayColumnBuilder {
  return new ArrayColumnBuilder(name);
}
