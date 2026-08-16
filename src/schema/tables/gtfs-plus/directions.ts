import { defineGtfsTable } from '../../define-table.ts';

export const directions = defineGtfsTable({
  file: 'directions.txt',
  presence: 'optional',
  primaryKey: ['route_id', 'direction_id'],
  fields: {
    route_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    direction: { kind: 'text', presence: 'required' },
  },
  namespace: 'gtfs-plus',
});
