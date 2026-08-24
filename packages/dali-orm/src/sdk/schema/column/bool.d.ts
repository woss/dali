import { BaseColumnBuilder } from './base.js';
export declare class BoolColumnBuilder extends BaseColumnBuilder<BoolColumnBuilder> {
  constructor(name: string);
  protected formatDefault(value: unknown): string;
}
export declare function bool(name?: string): BoolColumnBuilder;
//# sourceMappingURL=bool.d.ts.map
