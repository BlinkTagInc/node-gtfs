import { defineGtfsTable } from '../../define-table.ts';

export const vehiclePositions = defineGtfsTable({
  file: null,
  table: 'vehicle_positions',
  presence: 'optional',
  primaryKey: ['id'],
  fields: {
    id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'id',
      applyFeedPrefix: true,
    },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      sourcePath: 'vehicle.trip.tripId',
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      sourcePath: 'vehicle.trip.routeId',
      applyFeedPrefix: true,
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
      applyFeedPrefix: true,
    },
    modified_trip_affected_trip_id: {
      kind: 'id',
      sourcePath: 'vehicle.trip.modifiedTrip.affectedTripId',
      applyFeedPrefix: true,
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
      applyFeedPrefix: true,
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
      applyFeedPrefix: true,
    },
    current_status: {
      kind: 'enumeration',
      values: ['INCOMING_AT', 'STOPPED_AT', 'IN_TRANSIT_TO'],
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
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: ['trip_id', 'trip_start_date', 'trip_start_time', 'vehicle_id'],
  },
  namespace: 'gtfs-realtime',
});
