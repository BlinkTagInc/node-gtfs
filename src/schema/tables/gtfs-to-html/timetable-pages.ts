import { defineGtfsTable } from '../../define-table.ts';

export const timetablePages = defineGtfsTable({
  file: 'timetable_pages.txt',
  presence: 'optional',
  primaryKey: ['timetable_page_id'],
  fields: {
    timetable_page_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    timetable_page_label: { kind: 'text', caseInsensitiveComparison: true },
    filename: { kind: 'text' },
  },
  namespace: 'gtfs-to-html',
});
