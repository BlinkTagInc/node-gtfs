import { defineGtfsTable } from '../../define-table.ts';

export const calendar = defineGtfsTable({
  file: 'calendar.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyRequired',
  primaryKey: ['service_id'],
  fields: {
    service_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    monday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    tuesday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    wednesday: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    thursday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    friday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    saturday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    sunday: { kind: 'integer', presence: 'required', minimum: 0, maximum: 1 },
    start_date: { kind: 'date', presence: 'required' },
    end_date: { kind: 'date', presence: 'required' },
  },
  storage: {
    indexes: ['start_date', 'end_date'],
  },
});
