import { BaseColumnBuilder } from './base.js';

export class GeometryColumnBuilder extends BaseColumnBuilder<GeometryColumnBuilder> {
  constructor(name: string) {
    super(name, 'geometry');
  }

  protected formatDefault(value: unknown): string {
    return JSON.stringify(value);
  }
}

export function geometry(name: string): GeometryColumnBuilder {
  return new GeometryColumnBuilder(name);
}
