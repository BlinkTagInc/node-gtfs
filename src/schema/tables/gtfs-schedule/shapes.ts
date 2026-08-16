import { defineGtfsTable } from '../../define-table.ts';

export const shapes = defineGtfsTable({
  file: 'shapes.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['shape_id', 'shape_pt_sequence'],
  fields: {
    shape_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
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
