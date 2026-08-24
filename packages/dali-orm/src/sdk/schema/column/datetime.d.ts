import { BaseColumnBuilder } from './base.js';
export declare class DatetimeColumnBuilder extends BaseColumnBuilder<DatetimeColumnBuilder> {
  constructor(name: string);
  /** Format datetime defaults - handle function calls like time::now() without quotes */
  protected formatDefault(value: unknown): string;
}
export declare function datetime(name?: string): DatetimeColumnBuilder;
//# sourceMappingURL=datetime.d.ts.map
