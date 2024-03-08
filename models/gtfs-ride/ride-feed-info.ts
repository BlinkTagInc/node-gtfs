const model = {
  filenameBase: 'ride_feed_info',
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
      type: 'integer',
      index: true,
    },
    {
      name: 'ride_end_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'gtfs_feed_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'default_currency_type',
      type: 'varchar(255)',
    },
    {
      name: 'ride_feed_version',
      type: 'varchar(255)',
    },
  ],
};

export default model;
