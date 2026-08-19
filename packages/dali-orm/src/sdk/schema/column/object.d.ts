import { BaseColumnBuilder } from './base.js';
export declare class ObjectColumnBuilder extends BaseColumnBuilder<ObjectColumnBuilder> {
    constructor(name: string);
    protected formatDefault(value: unknown): string;
}
export declare function object(name: string): ObjectColumnBuilder;
//# sourceMappingURL=object.d.ts.map