import { defineGtfsDomainTable } from '../../domain-table.ts';

export const vehicleLocations = defineGtfsDomainTable({
  filename: 'vehicle_locations.csv',
  tableName: 'vehicle_locations',
  presence: 'optional',
  primaryKey: ['location_ping_id'],
  fields: {
    location_ping_id: {
      kind: 'id',
      presence: 'required',
    },
    service_date: { kind: 'date' },
    event_timestamp: { kind: 'text', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      references: [
        {
          targetFilename: 'trips_performed.csv',
          targetField: 'trip_id_performed',
        },
      ],
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [
        {
          targetFilename: 'trips_performed.csv',
          targetField: 'trip_id_scheduled',
        },
      ],
    },
    trip_stop_sequence: { kind: 'integer', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    device_id: {
      kind: 'id',
      references: [{ targetFilename: 'devices.csv', targetField: 'device_id' }],
    },
    pattern_id: { kind: 'id' },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
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
  specification: 'tides',
});
