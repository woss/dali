import { BaseColumnBuilder } from './base.js';
export declare class ArrayColumnBuilder extends BaseColumnBuilder<ArrayColumnBuilder> {
    constructor(name: string);
    protected formatDefault(value: unknown): string;
}
export declare function array(name?: string): ArrayColumnBuilder;
//# sourceMappingURL=array.d.ts.map