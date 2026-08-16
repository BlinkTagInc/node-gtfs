import { defineGtfsTable } from '../../define-table.ts';

export const locationGroups = defineGtfsTable({
  file: 'location_groups.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['location_group_id'],
  fields: {
    location_group_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    location_group_name: { kind: 'text', caseInsensitiveComparison: true },
  },
});
