import { BaseColumnBuilder } from './base.js';

export class GeometryColumnBuilder extends BaseColumnBuilder<GeometryColumnBuilder> {
  constructor(name: string) {
    super(name, 'geometry');
  }
}

export function geometry(name: string): GeometryColumnBuilder {
  return new GeometryColumnBuilder(name);
}
