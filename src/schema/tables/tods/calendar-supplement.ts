import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { calendar } from '../gtfs-schedule/calendar.ts';

export const calendarSupplement = defineGtfsDomainTable({
  filename: 'calendar_supplement.txt',
  tableName: 'calendar_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['service_id'],
  fields: {
    ...createTodsSupplementFields(calendar, ['service_id']),
    TODS_delete: todsDeleteField,
  },
});
