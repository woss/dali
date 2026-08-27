import { BaseColumnBuilder } from './base.js';

export class BoolColumnBuilder extends BaseColumnBuilder<BoolColumnBuilder> {
  constructor(name: string) {
    super(name, 'bool');
  }
}

export function bool(name: string = ''): BoolColumnBuilder {
  return new BoolColumnBuilder(name);
}
