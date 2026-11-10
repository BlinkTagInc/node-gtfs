import { defineGtfsDomainTable } from '../../domain-table.ts';

export const timeframes = defineGtfsDomainTable({
  filename: 'timeframes.txt',
  tableName: 'timeframes',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['timeframe_group_id', 'start_time', 'end_time', 'service_id'],
  fields: {
    timeframe_group_id: {
      kind: 'id',
      presence: 'required',
    },
    start_time: { kind: 'time', presence: 'conditionally-required' },
    end_time: { kind: 'time', presence: 'conditionally-required' },
    service_id: {
      kind: 'id',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
        { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
      ],
      presence: 'required',
    },
  },
});
