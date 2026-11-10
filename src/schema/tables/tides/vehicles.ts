import { defineGtfsDomainTable } from '../../domain-table.ts';

export const vehicles = defineGtfsDomainTable({
  filename: 'vehicles.csv',
  tableName: 'vehicles',
  presence: 'optional',
  primaryKey: ['vehicle_id'],
  fields: {
    vehicle_id: { kind: 'id', presence: 'required' },
    vehicle_start: { kind: 'text' },
    vehicle_end: { kind: 'text' },
    model_name: { kind: 'text' },
    facility_name: { kind: 'text' },
    capacity_seated: { kind: 'integer', minimum: 0 },
    capacity_wheelchair: { kind: 'integer', minimum: 0 },
    capacity_bike: { kind: 'integer', minimum: 0 },
    bike_rack: { kind: 'text' },
    capacity_standing: { kind: 'integer', minimum: 0 },
  },
  specification: 'tides',
});
