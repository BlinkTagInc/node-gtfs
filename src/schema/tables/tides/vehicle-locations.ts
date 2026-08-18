import { defineGtfsTable } from '../../define-table.ts';

export const vehicleLocations = defineGtfsTable({
  file: 'vehicle_locations.csv',
  presence: 'optional',
  primaryKey: ['location_ping_id'],
  fields: {
    location_ping_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    service_date: { kind: 'date' },
    event_timestamp: { kind: 'text', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_performed' }],
      applyFeedPrefix: true,
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_scheduled' }],
      applyFeedPrefix: true,
    },
    trip_stop_sequence: { kind: 'integer', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'vehicles.csv', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    device_id: {
      kind: 'id',
      references: [{ file: 'devices.csv', field: 'device_id' }],
      applyFeedPrefix: true,
    },
    pattern_id: { kind: 'id', applyFeedPrefix: true },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    current_status: { kind: 'text' },
    latitude: { kind: 'real', minimum: -90, maximum: 90 },
    longitude: { kind: 'real', minimum: -180, maximum: 180 },
    gps_quality: { kind: 'text' },
    heading: { kind: 'real', minimum: 0, maximum: 360 },
    speed: { kind: 'real', minimum: 0 },
    odometer: { kind: 'real', minimum: 0 },
    schedule_deviation: { kind: 'integer' },
    headway_deviation: { kind: 'integer' },
    trip_type: { kind: 'text' },
    schedule_relationship: { kind: 'text' },
  },
  namespace: 'tides',
});
