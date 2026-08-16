import { defineGtfsTable } from '../../define-table.ts';

export const tripCapacity = defineGtfsTable({
  file: 'trip_capacity.txt',
  presence: 'optional',
  fields: {
    agency_id: { kind: 'id', applyFeedPrefix: true },
    trip_id: { kind: 'id', applyFeedPrefix: true },
    service_date: { kind: 'date' },
    vehicle_description: { kind: 'text' },
    seated_capacity: { kind: 'integer', minimum: 0 },
    standing_capacity: { kind: 'integer', minimum: 0 },
    wheelchair_capacity: { kind: 'integer', minimum: 0 },
    bike_capacity: { kind: 'integer', minimum: 0 },
  },
  storage: {
    indexes: ['agency_id', 'trip_id', 'service_date'],
  },
  namespace: 'gtfs-ride',
});
