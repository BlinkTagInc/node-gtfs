import { defineGtfsDomainTable } from '../../domain-table.ts';

export const calendarDates = defineGtfsDomainTable({
  filename: 'calendar_dates.txt',
  tableName: 'calendar_dates',
  specification: 'gtfs-schedule',
  presence: 'conditionally-required',
  primaryKey: ['service_id', 'date'],
  fields: {
    service_id: { kind: 'id', presence: 'required' },
    date: { kind: 'date', presence: 'required' },
    exception_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 1,
      maximum: 2,
    },
    holiday_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
  },
});
