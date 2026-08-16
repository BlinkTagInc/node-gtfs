import { defineGtfsTable } from '../../define-table.ts';

export const stopTimeUpdates = defineGtfsTable({
  file: null,
  table: 'stop_time_updates',
  presence: 'optional',
  fields: {
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      sourcePath: 'parent.tripUpdate.trip.tripId',
      applyFeedPrefix: true,
    },
    trip_start_time: {
      kind: 'text',
      sourcePath: 'parent.tripUpdate.trip.startTime',
    },
    direction_id: {
      kind: 'integer',
      sourcePath: 'parent.tripUpdate.trip.directionId',
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      sourcePath: 'parent.tripUpdate.trip.routeId',
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      sourcePath: 'stopId',
      applyFeedPrefix: true,
    },
    stop_sequence: { kind: 'integer', sourcePath: 'stopSequence' },
    arrival_delay: { kind: 'integer', sourcePath: 'arrival.delay' },
    departure_delay: {
      kind: 'integer',
      sourcePath: 'departure.delay',
    },
    departure_timestamp: {
      kind: 'text',
      sourcePath: 'departure.time',
    },
    arrival_timestamp: { kind: 'text', sourcePath: 'arrival.time' },
    schedule_relationship: {
      kind: 'text',
      sourcePath: 'scheduleRelationship',
    },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: ['trip_id', 'route_id', 'stop_id'],
  },
  namespace: 'gtfs-realtime',
});
