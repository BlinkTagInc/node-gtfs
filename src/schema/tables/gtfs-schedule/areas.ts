import { defineGtfsTable } from '../../define-table.ts';

export const areas = defineGtfsTable({
  file: 'areas.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['area_id'],
  fields: {
    area_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    area_name: { kind: 'text', caseInsensitiveComparison: true },
  },
});
