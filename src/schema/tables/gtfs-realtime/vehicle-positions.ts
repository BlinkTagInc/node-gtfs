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
    bearing: {
      kind: 'real',
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
    current_stop_sequence: {
      kind: 'integer',
      sourcePath: 'vehicle.currentStopSequence',
    },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      sourcePath: 'vehicle.trip.tripId',
      applyFeedPrefix: true,
    },
    trip_start_date: {
      kind: 'text',
      sourcePath: 'vehicle.trip.startDate',
    },
    trip_start_time: {
      kind: 'text',
      sourcePath: 'vehicle.trip.startTime',
    },
    congestion_level: {
      kind: 'text',
      sourcePath: 'vehicle.congestionLevel',
    },
    occupancy_status: {
      kind: 'text',
      sourcePath: 'vehicle.occupancyStatus',
    },
    occupancy_percentage: {
      kind: 'integer',
      sourcePath: 'vehicle.occupancyPercentage',
    },
    vehicle_stop_status: {
      kind: 'text',
      sourcePath: 'vehicle.vehicleStopStatus',
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
      kind: 'text',
      sourcePath: 'vehicle.vehicle.wheelchairAccessible',
    },
    timestamp: { kind: 'text', sourcePath: 'vehicle.timestamp' },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: [
      'id',
      'trip_id',
      'trip_start_date',
      'trip_start_time',
      'vehicle_id',
    ],
  },
  namespace: 'gtfs-realtime',
});
