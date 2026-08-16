import { defineGtfsTable } from '../../define-table.ts';

export const tripUpdates = defineGtfsTable({
  file: null,
  table: 'trip_updates',
  presence: 'optional',
  primaryKey: ['id'],
  fields: {
    id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'id',
      applyFeedPrefix: true,
    },
    vehicle_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.vehicle.id',
      applyFeedPrefix: true,
    },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      sourcePath: 'tripUpdate.trip.tripId',
      applyFeedPrefix: true,
    },
    trip_start_time: {
      kind: 'text',
      sourcePath: 'tripUpdate.trip.startTime',
    },
    direction_id: {
      kind: 'integer',
      sourcePath: 'tripUpdate.trip.directionId',
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      sourcePath: 'tripUpdate.trip.routeId',
      applyFeedPrefix: true,
    },
    start_date: {
      kind: 'text',
      sourcePath: 'tripUpdate.trip.startDate',
    },
    timestamp: { kind: 'text', sourcePath: 'tripUpdate.timestamp' },
    schedule_relationship: {
      kind: 'text',
      sourcePath: 'tripUpdate.trip.scheduleRelationship',
    },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: ['id', 'vehicle_id', 'trip_id', 'route_id'],
  },
  namespace: 'gtfs-realtime',
});
