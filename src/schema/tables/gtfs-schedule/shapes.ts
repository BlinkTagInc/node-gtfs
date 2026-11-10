import { defineGtfsDomainTable } from '../../domain-table.ts';

export const shapes = defineGtfsDomainTable({
  filename: 'shapes.txt',
  tableName: 'shapes',
  specification: 'gtfs-schedule',
  presence: 'conditionally-required',
  primaryKey: ['shape_id', 'shape_pt_sequence'],
  fields: {
    shape_id: { kind: 'id', presence: 'required' },
    shape_pt_lat: {
      kind: 'real',
      presence: 'required',
      minimum: -90,
      maximum: 90,
    },
    shape_pt_lon: {
      kind: 'real',
      presence: 'required',
      minimum: -180,
      maximum: 180,
    },
    shape_pt_sequence: { kind: 'integer', presence: 'required', minimum: 0 },
    shape_dist_traveled: { kind: 'real', minimum: 0 },
  },
});
