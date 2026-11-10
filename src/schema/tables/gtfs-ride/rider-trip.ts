import { defineGtfsDomainTable } from '../../domain-table.ts';

export const riderTrip = defineGtfsDomainTable({
  filename: 'rider_trip.txt',
  tableName: 'rider_trip',
  presence: 'optional',
  primaryKey: ['rider_id'],
  fields: {
    rider_id: { kind: 'id', presence: 'required' },
    agency_id: { kind: 'id' },
    trip_id: { kind: 'id' },
    boarding_stop_id: { kind: 'id' },
    boarding_stop_sequence: { kind: 'integer', minimum: 0 },
    alighting_stop_id: { kind: 'id' },
    alighting_stop_sequence: { kind: 'integer', minimum: 0 },
    service_date: { kind: 'date' },
    boarding_time: { kind: 'time' },
    alighting_time: { kind: 'time' },
    rider_type: { kind: 'integer', minimum: 0, maximum: 13 },
    rider_type_description: { kind: 'text' },
    fare_paid: { kind: 'real' },
    transaction_type: { kind: 'integer', minimum: 0, maximum: 8 },
    fare_media: { kind: 'integer', minimum: 0, maximum: 9 },
    accompanying_device: { kind: 'integer', minimum: 0, maximum: 6 },
    transfer_status: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  specification: 'gtfs-ride',
});
