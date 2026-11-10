import { defineGtfsDomainTable } from '../../domain-table.ts';

export const transfers = defineGtfsDomainTable({
  filename: 'transfers.txt',
  tableName: 'transfers',
  specification: 'gtfs-schedule',
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
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    to_stop_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    from_route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    to_route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    from_trip_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    to_trip_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    transfer_type: { kind: 'integer', minimum: 0, maximum: 5, defaultValue: 0 },
    min_transfer_time: {
      kind: 'integer',
      presence: 'conditionally-required',
      minimum: 0,
    },
  },
});
