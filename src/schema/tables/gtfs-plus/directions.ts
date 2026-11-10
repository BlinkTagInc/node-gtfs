import { defineGtfsDomainTable } from '../../domain-table.ts';

export const directions = defineGtfsDomainTable({
  filename: 'directions.txt',
  tableName: 'directions',
  presence: 'optional',
  primaryKey: ['route_id', 'direction_id'],
  fields: {
    route_id: { kind: 'id', presence: 'required' },
    direction_id: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    direction: { kind: 'text', presence: 'required' },
  },
  specification: 'gtfs-plus',
});
