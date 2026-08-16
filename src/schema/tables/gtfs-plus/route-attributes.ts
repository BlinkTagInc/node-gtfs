import { defineGtfsTable } from '../../define-table.ts';

export const routeAttributes = defineGtfsTable({
  file: 'route_attributes.txt',
  presence: 'optional',
  primaryKey: ['route_id'],
  fields: {
    route_id: { kind: 'id', applyFeedPrefix: true },
    category: { kind: 'integer', presence: 'required', minimum: 0 },
    subcategory: { kind: 'integer', presence: 'required', minimum: 101 },
    running_way: { kind: 'integer', presence: 'required', minimum: 1 },
  },
  namespace: 'gtfs-plus',
});
