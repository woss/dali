import { BaseColumnBuilder } from './base.js';

export class DurationColumnBuilder extends BaseColumnBuilder<DurationColumnBuilder> {
  constructor(name: string) {
    super(name, 'duration');
  }
}

export function duration(name: string = ''): DurationColumnBuilder {
  return new DurationColumnBuilder(name);
}
