import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Query-oriented TripUpdate.stop_time_update rows in protobuf order. */
export const tripUpdateStopTimeUpdates = defineGtfsDomainTable({
  filename: null,
  tableName: 'trip_update_stop_time_updates',
  presence: 'optional',
  primaryKey: [
    'realtime_feed_id',
    'trip_update_id',
    'stop_time_update_ordinal',
  ],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    trip_update_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'parent.id',
    },
    stop_time_update_ordinal: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
      sourcePath: 'parent.tripUpdate.trip.tripId',
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
      minimum: 0,
      maximum: 1,
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
      sourcePath: 'parent.tripUpdate.trip.routeId',
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
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      sourcePath: 'stopId',
    },
    stop_sequence: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'stopSequence',
    },
    arrival_delay: { kind: 'integer', sourcePath: 'arrival.delay' },
    arrival_unix_seconds: { kind: 'integer', sourcePath: 'arrival.time' },
    arrival_uncertainty: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'arrival.uncertainty',
    },
    arrival_scheduled_unix_seconds: {
      kind: 'integer',
      sourcePath: 'arrival.scheduledTime',
    },
    departure_delay: {
      kind: 'integer',
      sourcePath: 'departure.delay',
    },
    departure_unix_seconds: {
      kind: 'integer',
      sourcePath: 'departure.time',
    },
    departure_uncertainty: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'departure.uncertainty',
    },
    departure_scheduled_unix_seconds: {
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
    created_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    expires_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
