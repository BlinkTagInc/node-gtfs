import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Current trip-update rows, scoped by their stable feed source. */
export const tripUpdates = defineGtfsDomainTable({
  filename: null,
  tableName: 'trip_updates',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'entity_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    entity_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'id',
    },
    vehicle_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.vehicle.id',
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
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
      sourcePath: 'tripUpdate.trip.tripId',
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
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
      sourcePath: 'tripUpdate.trip.routeId',
    },
    trip_start_date: {
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
    },
    modified_trip_affected_trip_id: {
      kind: 'id',
      sourcePath: 'tripUpdate.trip.modifiedTrip.affectedTripId',
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
    },
    trip_properties_trip_headsign: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.tripHeadsign',
    },
    trip_properties_trip_short_name: {
      kind: 'text',
      sourcePath: 'tripUpdate.tripProperties.tripShortName',
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
