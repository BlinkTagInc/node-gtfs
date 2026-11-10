import { defineGtfsDomainTable } from '../../domain-table.ts';

export const ridership = defineGtfsDomainTable({
  filename: 'ridership.txt',
  tableName: 'ridership',
  presence: 'optional',
  fields: {
    total_boardings: { kind: 'integer', presence: 'required', minimum: 0 },
    total_alightings: { kind: 'integer', presence: 'required', minimum: 0 },
    ridership_start_date: { kind: 'date' },
    ridership_end_date: { kind: 'date' },
    ridership_start_time: { kind: 'time' },
    ridership_end_time: { kind: 'time' },
    service_id: { kind: 'id' },
    monday: { kind: 'integer', minimum: 0, maximum: 1 },
    tuesday: { kind: 'integer', minimum: 0, maximum: 1 },
    wednesday: { kind: 'integer', minimum: 0, maximum: 1 },
    thursday: { kind: 'integer', minimum: 0, maximum: 1 },
    friday: { kind: 'integer', minimum: 0, maximum: 1 },
    saturday: { kind: 'integer', minimum: 0, maximum: 1 },
    sunday: { kind: 'integer', minimum: 0, maximum: 1 },
    agency_id: { kind: 'id' },
    route_id: { kind: 'id' },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    trip_id: { kind: 'id' },
    stop_id: { kind: 'id' },
  },
  specification: 'gtfs-ride',
});
