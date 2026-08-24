import { BaseColumnBuilder } from './base.js';
export declare class IntColumnBuilder extends BaseColumnBuilder<IntColumnBuilder> {
  constructor(name: string);
  protected formatDefault(value: unknown): string;
}
export declare function int(name?: string): IntColumnBuilder;
//# sourceMappingURL=int.d.ts.map
