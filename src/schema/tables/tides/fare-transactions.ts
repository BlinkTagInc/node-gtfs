import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareTransactions = defineGtfsDomainTable({
  filename: 'fare_transactions.csv',
  tableName: 'fare_transactions',
  presence: 'optional',
  primaryKey: ['transaction_id'],
  fields: {
    transaction_id: { kind: 'id', presence: 'required' },
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
    amount: {
      kind: 'real',
      presence: 'required',
      monetary: {
        currencyField: 'currency_type',
        publicRepresentation: 'decimal-string',
      },
    },
    currency_type: { kind: 'text' },
    fare_action: { kind: 'text', presence: 'required' },
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
    pattern_id: { kind: 'id' },
    trip_stop_sequence: { kind: 'integer', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    vehicle_id: {
      kind: 'id',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    device_id: {
      kind: 'id',
      references: [{ targetFilename: 'devices.csv', targetField: 'device_id' }],
    },
    fare_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_attributes.txt', targetField: 'fare_id' },
      ],
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    num_riders: { kind: 'integer', minimum: 0 },
    fare_media_id: { kind: 'id' },
    rider_category: { kind: 'text' },
    fare_product: { kind: 'text' },
    fare_period: { kind: 'text' },
    fare_capped: { kind: 'text', presence: 'required' },
    token_id: { kind: 'id' },
    balance: {
      kind: 'real',
      monetary: {
        currencyField: 'currency_type',
        publicRepresentation: 'decimal-string',
      },
    },
  },
  specification: 'tides',
});
