import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timetablePages = defineGtfsDomainTable({
  filename: 'timetable_pages.txt',
  tableName: 'timetable_pages',
  presence: 'optional',
  primaryKey: ['timetable_page_id'],
  fields: {
    timetable_page_id: {
      kind: 'id',
      presence: 'required',
    },
    timetable_page_label: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
    filename: { kind: 'text' },
  },
  specification: 'gtfs-to-html',
});
