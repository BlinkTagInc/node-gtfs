import { defineGtfsTable } from '../../define-table.ts';

export const riderTrip = defineGtfsTable({
  file: 'rider_trip.txt',
  presence: 'optional',
  primaryKey: ['rider_id'],
  fields: {
    rider_id: { kind: 'id', applyFeedPrefix: true },
    agency_id: { kind: 'id', applyFeedPrefix: true },
    trip_id: { kind: 'id', applyFeedPrefix: true },
    boarding_stop_id: { kind: 'id', applyFeedPrefix: true },
    boarding_stop_sequence: { kind: 'integer', minimum: 0 },
    alighting_stop_id: { kind: 'id', applyFeedPrefix: true },
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
  storage: {
    indexes: [
      'agency_id',
      'trip_id',
      'boarding_stop_id',
      'boarding_stop_sequence',
      'alighting_stop_id',
      'alighting_stop_sequence',
      'service_date',
    ],
  },
  namespace: 'gtfs-ride',
});
