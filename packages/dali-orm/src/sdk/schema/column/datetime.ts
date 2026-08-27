import { BaseColumnBuilder } from './base.js';

export class DatetimeColumnBuilder extends BaseColumnBuilder<DatetimeColumnBuilder> {
  constructor(name: string) {
    super(name, 'datetime');
  }
}

export function datetime(name: string = ''): DatetimeColumnBuilder {
  return new DatetimeColumnBuilder(name);
}
