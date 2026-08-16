import { defineGtfsTable } from '../../define-table.ts';

export const translations = defineGtfsTable({
  file: 'translations.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'table_name',
    'field_name',
    'language',
    'record_id',
    'record_sub_id',
    'field_value',
  ],
  fields: {
    table_name: { kind: 'text', presence: 'required' },
    field_name: { kind: 'text', presence: 'required' },
    language: { kind: 'text', presence: 'required' },
    translation: { kind: 'text', presence: 'required' },
    record_id: { kind: 'id', applyFeedPrefix: true },
    record_sub_id: { kind: 'id' },
    field_value: { kind: 'text' },
  },
});
