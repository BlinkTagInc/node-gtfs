import { defineGtfsDomainTable } from '../../domain-table.ts';

const currentStatusValues = [
  'INCOMING_AT',
  'STOPPED_AT',
  'IN_TRANSIT_TO',
] as const;

/** Current vehicle-position rows, scoped by their stable feed source. */
export const vehiclePositions = defineGtfsDomainTable({
  filename: null,
  tableName: 'vehicle_positions',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'entity_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    entity_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'id',
    },
    trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
      sourcePath: 'vehicle.trip.tripId',
    },
    route_id: {
      kind: 'id',
      sourcePath: 'vehicle.trip.routeId',
    },
    direction_id: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
      sourcePath: 'vehicle.trip.directionId',
    },
    trip_start_time: {
      kind: 'text',
      sourcePath: 'vehicle.trip.startTime',
    },
    trip_start_date: {
      kind: 'text',
      sourcePath: 'vehicle.trip.startDate',
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
      sourcePath: 'vehicle.trip.scheduleRelationship',
    },
    modified_trip_modifications_id: {
      kind: 'id',
      sourcePath: 'vehicle.trip.modifiedTrip.modificationsId',
    },
    modified_trip_affected_trip_id: {
      kind: 'id',
      sourcePath: 'vehicle.trip.modifiedTrip.affectedTripId',
    },
    modified_trip_start_time: {
      kind: 'text',
      sourcePath: 'vehicle.trip.modifiedTrip.startTime',
    },
    modified_trip_start_date: {
      kind: 'text',
      sourcePath: 'vehicle.trip.modifiedTrip.startDate',
    },
    vehicle_id: {
      kind: 'id',
      sourcePath: 'vehicle.vehicle.id',
    },
    vehicle_label: {
      kind: 'text',
      sourcePath: 'vehicle.vehicle.label',
    },
    vehicle_license_plate: {
      kind: 'text',
      sourcePath: 'vehicle.vehicle.licensePlate',
    },
    vehicle_wheelchair_accessible: {
      kind: 'enumeration',
      values: [
        'NO_VALUE',
        'UNKNOWN',
        'WHEELCHAIR_ACCESSIBLE',
        'WHEELCHAIR_INACCESSIBLE',
      ],
      sourcePath: 'vehicle.vehicle.wheelchairAccessible',
    },
    bearing: {
      kind: 'real',
      minimum: 0,
      sourcePath: 'vehicle.position.bearing',
    },
    latitude: {
      kind: 'real',
      minimum: -90,
      maximum: 90,
      sourcePath: 'vehicle.position.latitude',
    },
    longitude: {
      kind: 'real',
      minimum: -180,
      maximum: 180,
      sourcePath: 'vehicle.position.longitude',
    },
    speed: {
      kind: 'real',
      minimum: 0,
      sourcePath: 'vehicle.position.speed',
    },
    odometer: {
      kind: 'real',
      minimum: 0,
      sourcePath: 'vehicle.position.odometer',
    },
    current_stop_sequence: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'vehicle.currentStopSequence',
    },
    stop_id: {
      kind: 'id',
      sourcePath: 'vehicle.stopId',
    },
    current_status: {
      kind: 'enumeration',
      values: currentStatusValues,
      sourcePath: 'vehicle.currentStatus',
    },
    congestion_level: {
      kind: 'enumeration',
      values: [
        'UNKNOWN_CONGESTION_LEVEL',
        'RUNNING_SMOOTHLY',
        'STOP_AND_GO',
        'CONGESTION',
        'SEVERE_CONGESTION',
      ],
      sourcePath: 'vehicle.congestionLevel',
    },
    occupancy_status: {
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
      sourcePath: 'vehicle.occupancyStatus',
    },
    occupancy_percentage: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'vehicle.occupancyPercentage',
    },
    multi_carriage_details: {
      kind: 'json',
      sourcePath: 'vehicle.multiCarriageDetails',
    },
    timestamp: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'vehicle.timestamp',
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
