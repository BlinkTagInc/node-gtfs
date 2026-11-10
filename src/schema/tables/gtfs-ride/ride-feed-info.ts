import { defineGtfsDomainTable } from '../../domain-table.ts';

export const rideFeedInfo = defineGtfsDomainTable({
  filename: 'ride_feed_info.txt',
  tableName: 'ride_feed_info',
  presence: 'optional',
  fields: {
    ride_files: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 6,
    },
    ride_start_date: { kind: 'date' },
    ride_end_date: { kind: 'date' },
    gtfs_feed_date: { kind: 'date' },
    default_currency_type: { kind: 'text' },
    ride_feed_version: { kind: 'text' },
  },
  specification: 'gtfs-ride',
});
