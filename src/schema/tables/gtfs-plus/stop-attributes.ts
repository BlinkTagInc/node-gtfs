import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stopAttributes = defineGtfsDomainTable({
  filename: 'stop_attributes.txt',
  tableName: 'stop_attributes',
  presence: 'optional',
  primaryKey: ['stop_id'],
  fields: {
    stop_id: { kind: 'id', presence: 'required' },
    accessibility_id: { kind: 'integer', minimum: 0 },
    cardinal_direction: { kind: 'text' },
    relative_position: { kind: 'text' },
    stop_city: { kind: 'text', supportsCaseInsensitiveComparison: true },
  },
  specification: 'gtfs-plus',
});
