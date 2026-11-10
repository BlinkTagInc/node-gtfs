import { defineGtfsDomainTable } from '../../domain-table.ts';

export const passengerEvents = defineGtfsDomainTable({
  filename: 'passenger_events.csv',
  tableName: 'passenger_events',
  presence: 'optional',
  primaryKey: ['passenger_event_id'],
  fields: {
    passenger_event_id: {
      kind: 'id',
      presence: 'required',
    },
    service_date: { kind: 'date', presence: 'required' },
    event_timestamp: { kind: 'text', presence: 'required' },
    location_ping_id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'vehicle_locations.csv',
          targetField: 'location_ping_id',
        },
      ],
    },
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
    trip_stop_sequence: { kind: 'integer', presence: 'required', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    event_type: { kind: 'text', presence: 'required' },
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
    train_car_id: {
      kind: 'id',
      references: [
        { targetFilename: 'train_cars.csv', targetField: 'train_car_id' },
      ],
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    pattern_id: { kind: 'id' },
    event_count: { kind: 'integer', minimum: 0 },
  },
  specification: 'tides',
});
