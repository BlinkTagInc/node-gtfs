import { defineGtfsTable } from '../../define-table.ts';

export const transfers = defineGtfsTable({
  file: 'transfers.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'from_stop_id',
    'to_stop_id',
    'from_trip_id',
    'to_trip_id',
    'from_route_id',
    'to_route_id',
  ],
  fields: {
    from_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    to_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    from_route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    to_route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    from_trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    to_trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    transfer_type: { kind: 'integer', minimum: 0, maximum: 5, defaultValue: 0 },
    min_transfer_time: { kind: 'integer', minimum: 0 },
  },
});
