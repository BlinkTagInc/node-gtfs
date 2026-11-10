import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { calendarDates } from '../gtfs-schedule/calendar-dates.ts';

export const calendarDatesSupplement = defineGtfsDomainTable({
  filename: 'calendar_dates_supplement.txt',
  tableName: 'calendar_dates_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['service_id', 'date'],
  fields: {
    ...createTodsSupplementFields(calendarDates, ['service_id', 'date']),
    TODS_delete: todsDeleteField,
  },
});
