import { defineGtfsDomainTable } from '../../domain-table.ts';

export const calendarAttributes = defineGtfsDomainTable({
  filename: 'calendar_attributes.txt',
  tableName: 'calendar_attributes',
  presence: 'optional',
  primaryKey: ['service_id'],
  fields: {
    service_id: { kind: 'id', presence: 'required' },
    service_description: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
  },
  specification: 'gtfs-plus',
});
