const model = {
  filenameBase: 'rider_trip',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'rider_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'agency_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'boarding_stop_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'boarding_stop_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
    {
      name: 'alighting_stop_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'alighting_stop_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
    {
      name: 'service_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'boarding_time',
      type: 'varchar(255)',
    },
    {
      name: 'boarding_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'alighting_time',
      type: 'varchar(255)',
    },
    {
      name: 'alighting_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'rider_type',
      type: 'integer',
      min: 0,
      max: 13,
    },
    {
      name: 'rider_type_description',
      type: 'varchar(255)',
    },
    {
      name: 'fare_paid',
      type: 'real',
    },
    {
      name: 'transaction_type',
      type: 'integer',
      min: 0,
      max: 8,
    },
    {
      name: 'fare_media',
      type: 'integer',
      min: 0,
      max: 9,
    },
    {
      name: 'accompanying_device',
      type: 'integer',
      min: 0,
      max: 6,
    },
    {
      name: 'transfer_status',
      type: 'integer',
      min: 0,
      max: 1,
    },
  ],
};

export default model;
