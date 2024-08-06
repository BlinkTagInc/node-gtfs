export const rideFeedInfo = {
  filenameBase: 'ride_feed_info',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'ride_files',
      type: 'integer',
      min: 0,
      max: 6,
      required: true,
    },
    {
      name: 'ride_start_date',
      type: 'date',
      index: true,
    },
    {
      name: 'ride_end_date',
      type: 'date',
      index: true,
    },
    {
      name: 'gtfs_feed_date',
      type: 'date',
      index: true,
    },
    {
      name: 'default_currency_type',
      type: 'text',
    },
    {
      name: 'ride_feed_version',
      type: 'text',
    },
  ],
};
