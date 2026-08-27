import { BaseColumnBuilder } from './base.js';

export class StringColumnBuilder extends BaseColumnBuilder<StringColumnBuilder> {
  constructor(name: string) {
    super(name, 'string');
  }
}

export function string(name = ''): StringColumnBuilder {
  return new StringColumnBuilder(name);
}
