import { defineGtfsTable } from '../../define-table.ts';

export const fareTransactions = defineGtfsTable({
  file: 'fare_transactions.csv',
  presence: 'optional',
  fields: {
    transaction_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    service_date: { kind: 'date', presence: 'required' },
    event_timestamp: { kind: 'text', presence: 'required' },
    location_ping_id: {
      kind: 'id',
      references: [
        { file: 'vehicle_locations.csv', field: 'location_ping_id' },
      ],
      applyFeedPrefix: true,
    },
    amount: { kind: 'real', presence: 'required' },
    currency_type: { kind: 'text' },
    fare_action: { kind: 'text', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_performed' }],
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [{ file: 'trips_performed.csv', field: 'trip_id_scheduled' }],
    },
    pattern_id: { kind: 'id', applyFeedPrefix: true },
    trip_stop_sequence: { kind: 'integer', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    vehicle_id: {
      kind: 'id',
      references: [{ file: 'vehicles.csv', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    device_id: {
      kind: 'id',
      references: [{ file: 'devices.csv', field: 'device_id' }],
      applyFeedPrefix: true,
    },
    fare_id: {
      kind: 'id',
      references: [{ file: 'fare_attributes.txt', field: 'fare_id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    num_riders: { kind: 'integer', minimum: 0 },
    fare_media_id: { kind: 'id', applyFeedPrefix: true },
    rider_category: { kind: 'text' },
    fare_product: { kind: 'text' },
    fare_period: { kind: 'text' },
    fare_capped: { kind: 'text', presence: 'required' },
    token_id: { kind: 'id', applyFeedPrefix: true },
    balance: { kind: 'real' },
  },
  storage: {
    indexes: ['transaction_id'],
  },
  namespace: 'tides',
});
