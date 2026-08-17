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
    vehicle_label: {
      kind: 'text',
      sourcePath: 'tripUpdate.vehicle.label',
    },
    vehicle_license_plate: {
      kind: 'text',
      sourcePath: 'tripUpdate.vehicle.licensePlate',
    },
    vehicle_wheelchair_accessible: {
      kind: 'enumeration',
      values: [
        'NO_VALUE',
        'UNKNOWN',
        'WHEELCHAIR_ACCESSIBLE',
        'WHEELCHAIR_INACCESSIBLE',
      ],
      sourcePath: 'tripUpdate.vehicle.wheelchairAccessible',
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
      minimum: 0,
      maximum: 1,
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
    timestamp: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'tripUpdate.timestamp',
    },
    schedule_relationship: {
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
      sourcePath: 'tripUpdate.trip.scheduleRelationship',
    },
    modified_trip_modifications_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.trip.modifiedTrip.modificationsId',
      applyFeedPrefix: true,
    },
    modified_trip_affected_trip_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.trip.modifiedTrip.affectedTripId',
      applyFeedPrefix: true,
    },
    modified_trip_start_time: {
      kind: 'text',
      sourcePath: 'tripUpdate.trip.modifiedTrip.startTime',
    },
    modified_trip_start_date: {
      kind: 'text',
      sourcePath: 'tripUpdate.trip.modifiedTrip.startDate',
    },
    delay: { kind: 'integer', sourcePath: 'tripUpdate.delay' },
    trip_properties_trip_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.tripProperties.tripId',
      applyFeedPrefix: true,
    },
    trip_properties_start_date: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.startDate',
    },
    trip_properties_start_time: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.startTime',
    },
    trip_properties_shape_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.tripProperties.shapeId',
      applyFeedPrefix: true,
    },
    trip_properties_trip_headsign: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.tripHeadsign',
    },
    trip_properties_trip_short_name: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.tripShortName',
    },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: [
      'id',
      'vehicle_id',
      'trip_id',
      'route_id',
      'trip_properties_trip_id',
    ],
  },
  namespace: 'gtfs-realtime',
});
