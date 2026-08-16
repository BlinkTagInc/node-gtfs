import { defineGtfsTable } from '../../define-table.ts';

export const fareRules = defineGtfsTable({
  file: 'fare_rules.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'fare_id',
    'route_id',
    'origin_id',
    'destination_id',
    'contains_id',
  ],
  fields: {
    fare_id: {
      kind: 'id',
      references: [{ file: 'fare_attributes.txt', field: 'fare_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    origin_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'zone_id' }],
      applyFeedPrefix: true,
    },
    destination_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'zone_id' }],
      applyFeedPrefix: true,
    },
    contains_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'zone_id' }],
      applyFeedPrefix: true,
    },
  },
});
