import { defineGtfsDomainTable } from '../../domain-table.ts';

export const todsVehicles = defineGtfsDomainTable({
  filename: 'vehicles.txt',
  tableName: 'tods_vehicles',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['vehicle_id'],
  fields: {
    vehicle_id: { kind: 'id', presence: 'required' },
    vehicle_label: { kind: 'text' },
    license_plate: { kind: 'text' },
  },
});
