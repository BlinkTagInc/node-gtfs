import { defineGtfsTable } from '../../define-table.ts';

export const stopTimeUpdates = defineGtfsTable({
  file: null,
  table: 'stop_time_updates',
  presence: 'optional',
  fields: {
    trip_update_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'parent.id',
      applyFeedPrefix: true,
    },
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
    trip_start_date: {
      kind: 'text',
      sourcePath: 'parent.tripUpdate.trip.startDate',
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
    trip_schedule_relationship: {
      kind: 'enumeration',
      values: [
        'SCHEDULED',
        'ADDED',
        'UNSCHEDULED',
        'CANCELED',
        'REPLACEMENT',
        'DUPLICATED',
        'DELETED',
        'NEW',
      ],
      sourcePath: 'parent.tripUpdate.trip.scheduleRelationship',
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      sourcePath: 'stopId',
      applyFeedPrefix: true,
    },
    stop_sequence: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'stopSequence',
    },
    arrival_delay: { kind: 'integer', sourcePath: 'arrival.delay' },
    arrival_timestamp: { kind: 'integer', sourcePath: 'arrival.time' },
    arrival_uncertainty: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'arrival.uncertainty',
    },
    arrival_scheduled_timestamp: {
      kind: 'integer',
      sourcePath: 'arrival.scheduledTime',
    },
    departure_delay: {
      kind: 'integer',
      sourcePath: 'departure.delay',
    },
    departure_timestamp: {
      kind: 'integer',
      sourcePath: 'departure.time',
    },
    departure_uncertainty: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'departure.uncertainty',
    },
    departure_scheduled_timestamp: {
      kind: 'integer',
      sourcePath: 'departure.scheduledTime',
    },
    departure_occupancy_status: {
      kind: 'enumeration',
      values: [
        'EMPTY',
        'MANY_SEATS_AVAILABLE',
        'FEW_SEATS_AVAILABLE',
        'STANDING_ROOM_ONLY',
        'CRUSHED_STANDING_ROOM_ONLY',
        'FULL',
        'NOT_ACCEPTING_PASSENGERS',
        'NO_DATA_AVAILABLE',
        'NOT_BOARDABLE',
      ],
      sourcePath: 'departureOccupancyStatus',
    },
    schedule_relationship: {
      kind: 'enumeration',
      values: ['SCHEDULED', 'SKIPPED', 'NO_DATA', 'UNSCHEDULED'],
      sourcePath: 'scheduleRelationship',
    },
    assigned_stop_id: {
      kind: 'id',
      sourcePath: 'stopTimeProperties.assignedStopId',
      applyFeedPrefix: true,
    },
    stop_headsign: {
      kind: 'text',
      sourcePath: 'stopTimeProperties.stopHeadsign',
    },
    pickup_type: {
      kind: 'enumeration',
      values: ['REGULAR', 'NONE', 'PHONE_AGENCY', 'COORDINATE_WITH_DRIVER'],
      sourcePath: 'stopTimeProperties.pickupType',
    },
    drop_off_type: {
      kind: 'enumeration',
      values: ['REGULAR', 'NONE', 'PHONE_AGENCY', 'COORDINATE_WITH_DRIVER'],
      sourcePath: 'stopTimeProperties.dropOffType',
    },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: [
      'trip_update_id',
      'trip_id',
      'route_id',
      'stop_id',
      'assigned_stop_id',
    ],
  },
  namespace: 'gtfs-realtime',
});
