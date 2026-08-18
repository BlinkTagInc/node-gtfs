import { defineGtfsTable } from '../../define-table.ts';

export const passengerEvents = defineGtfsTable({
  file: 'passenger_events.csv',
  presence: 'optional',
  fields: {
    passenger_event_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    service_date: { kind: 'date', presence: 'required' },
    event_timestamp: { kind: 'text', presence: 'required' },
    location_ping_id: {
      kind: 'id',
      references: [
        { file: 'vehicle_locations.csv', field: 'location_ping_id' },
      ],
      applyFeedPrefix: true,
    },
    trip_id_performed: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_performed' }],
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_scheduled' }],
    },
    trip_stop_sequence: { kind: 'integer', presence: 'required', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    event_type: { kind: 'text', presence: 'required' },
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
    train_car_id: {
      kind: 'id',
      references: [{ file: 'train_cars.csv', field: 'train_car_id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    pattern_id: { kind: 'id', applyFeedPrefix: true },
    event_count: { kind: 'integer', minimum: 0 },
  },
  storage: {
    indexes: ['passenger_event_id'],
  },
  namespace: 'tides',
});
