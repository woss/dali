import { BaseColumnBuilder } from './base.js';

export class FloatColumnBuilder extends BaseColumnBuilder<FloatColumnBuilder> {
  constructor(name: string) {
    super(name, 'float');
  }
}

export function float(name: string = ''): FloatColumnBuilder {
  return new FloatColumnBuilder(name);
}
