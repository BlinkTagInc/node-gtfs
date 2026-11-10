import { defineGtfsDomainTable } from '../../domain-table.ts';

export const routeAttributes = defineGtfsDomainTable({
  filename: 'route_attributes.txt',
  tableName: 'route_attributes',
  presence: 'optional',
  primaryKey: ['route_id'],
  fields: {
    route_id: { kind: 'id', presence: 'required' },
    category: { kind: 'integer', presence: 'required', minimum: 0 },
    subcategory: { kind: 'integer', presence: 'required', minimum: 101 },
    running_way: { kind: 'integer', presence: 'required', minimum: 1 },
  },
  specification: 'gtfs-plus',
});
