import { BaseColumnBuilder } from './base.js';
export declare class StringColumnBuilder extends BaseColumnBuilder<StringColumnBuilder> {
  constructor(name: string);
  protected formatDefault(value: unknown): string;
}
export declare function string(name?: string): StringColumnBuilder;
//# sourceMappingURL=string.d.ts.map
