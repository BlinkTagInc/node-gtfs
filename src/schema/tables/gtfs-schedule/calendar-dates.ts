import { defineGtfsTable } from '../../define-table.ts';

export const calendarDates = defineGtfsTable({
  file: 'calendar_dates.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyRequired',
  primaryKey: ['service_id', 'date'],
  fields: {
    service_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    date: { kind: 'date', presence: 'required' },
    exception_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 1,
      maximum: 2,
    },
    holiday_name: { kind: 'text', caseInsensitiveComparison: true },
  },
  storage: {
    indexes: ['exception_type', ['date', 'exception_type', 'service_id']],
  },
});
