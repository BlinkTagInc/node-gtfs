import { defineGtfsDomainTable } from '../../domain-table.ts';

export const locations = defineGtfsDomainTable({
  filename: 'locations.geojson',
  tableName: 'locations',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['id'],
  fields: {
    id: { kind: 'id', presence: 'required' },
    stop_name: { kind: 'text' },
    stop_desc: { kind: 'text' },
    geometry: { kind: 'json', presence: 'required' },
  },
});
