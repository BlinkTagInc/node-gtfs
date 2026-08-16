import { defineGtfsTable } from '../../define-table.ts';

export const calendarAttributes = defineGtfsTable({
  file: 'calendar_attributes.txt',
  presence: 'optional',
  primaryKey: ['service_id'],
  fields: {
    service_id: { kind: 'id', applyFeedPrefix: true },
    service_description: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
    },
  },
  namespace: 'gtfs-plus',
});
