import { defineGtfsDomainTable } from '../../domain-table.ts';

export const locationGroups = defineGtfsDomainTable({
  filename: 'location_groups.txt',
  tableName: 'location_groups',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['location_group_id'],
  fields: {
    location_group_id: {
      kind: 'id',
      presence: 'required',
    },
    location_group_name: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
  },
});
