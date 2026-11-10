import { defineGtfsDomainTable } from '../../domain-table.ts';

export const tripCapacity = defineGtfsDomainTable({
  filename: 'trip_capacity.txt',
  tableName: 'trip_capacity',
  presence: 'optional',
  fields: {
    agency_id: { kind: 'id' },
    trip_id: { kind: 'id' },
    service_date: { kind: 'date' },
    vehicle_description: { kind: 'text' },
    seated_capacity: { kind: 'integer', minimum: 0 },
    standing_capacity: { kind: 'integer', minimum: 0 },
    wheelchair_capacity: { kind: 'integer', minimum: 0 },
    bike_capacity: { kind: 'integer', minimum: 0 },
  },
  specification: 'gtfs-ride',
});
