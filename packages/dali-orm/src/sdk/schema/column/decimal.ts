import { BaseColumnBuilder } from './base.js';

export class DecimalColumnBuilder extends BaseColumnBuilder<DecimalColumnBuilder> {
  constructor(name: string) {
    super(name, 'decimal');
  }
}

export function decimal(name: string = ''): DecimalColumnBuilder {
  return new DecimalColumnBuilder(name);
}
