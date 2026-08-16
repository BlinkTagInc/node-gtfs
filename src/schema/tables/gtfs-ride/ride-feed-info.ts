import { defineGtfsTable } from '../../define-table.ts';

export const rideFeedInfo = defineGtfsTable({
  file: 'ride_feed_info.txt',
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
  storage: {
    indexes: ['ride_start_date', 'ride_end_date', 'gtfs_feed_date'],
  },
  namespace: 'gtfs-ride',
});
