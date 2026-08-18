import { defineGtfsTable } from '../../define-table.ts';

export const timeframes = defineGtfsTable({
  file: 'timeframes.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['timeframe_group_id', 'start_time', 'end_time', 'service_id'],
  fields: {
    timeframe_group_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    start_time: { kind: 'time', presence: 'conditionallyRequired' },
    end_time: { kind: 'time', presence: 'conditionallyRequired' },
    service_id: {
      kind: 'id',
      references: [
        { file: 'calendar.txt', field: 'service_id' },
        { file: 'calendar_dates.txt', field: 'service_id' },
      ],
      presence: 'required',
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: ['service_id'],
  },
});
