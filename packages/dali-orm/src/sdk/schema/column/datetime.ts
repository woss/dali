import { BaseColumnBuilder } from './base.js';
import { quoteString } from '../../../core/surql.ts';

export class DatetimeColumnBuilder extends BaseColumnBuilder<DatetimeColumnBuilder> {
  constructor(name: string) {
    super(name, 'datetime');
  }

  /** Format datetime defaults - handle function calls like time::now() without quotes */
  protected formatDefault(value: unknown): string {
    const str = String(value);
    // If value contains function call pattern (::), keep as-is
    if (str.includes('::')) {
      return str;
    }
    // If value is a special keyword or relative duration, keep as-is
    if (str === 'now' || str.startsWith('+') || str.startsWith('!')) {
      return str;
    }
    // Return ISO strings as-is (already formatted)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
      return str;
    }
    // Otherwise wrap in quotes for literal datetime strings
    return quoteString(str);
  }
}

export function datetime(name: string = ''): DatetimeColumnBuilder {
  return new DatetimeColumnBuilder(name);
}
