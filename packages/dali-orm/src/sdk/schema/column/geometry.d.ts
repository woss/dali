import { BaseColumnBuilder } from './base.js';
export declare class GeometryColumnBuilder extends BaseColumnBuilder<GeometryColumnBuilder> {
    constructor(name: string);
    protected formatDefault(value: unknown): string;
}
export declare function geometry(name: string): GeometryColumnBuilder;
//# sourceMappingURL=geometry.d.ts.map