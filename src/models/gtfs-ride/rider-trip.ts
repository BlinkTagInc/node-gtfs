export const riderTrip = {
  filenameBase: 'rider_trip',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'rider_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'agency_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'boarding_stop_id',
      type: 'text',
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
      type: 'text',
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
      type: 'date',
      index: true,
    },
    {
      name: 'boarding_time',
      type: 'time',
    },
    {
      name: 'alighting_time',
      type: 'time',
    },
    {
      name: 'rider_type',
      type: 'integer',
      min: 0,
      max: 13,
    },
    {
      name: 'rider_type_description',
      type: 'text',
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
