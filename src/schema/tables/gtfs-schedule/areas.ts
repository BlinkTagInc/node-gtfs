import { defineGtfsDomainTable } from '../../domain-table.ts';

export const areas = defineGtfsDomainTable({
  filename: 'areas.txt',
  tableName: 'areas',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['area_id'],
  fields: {
    area_id: { kind: 'id', presence: 'required' },
    area_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
  },
});
