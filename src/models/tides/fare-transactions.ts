export const fareTransactions = {
  filenameBase: 'fare_transactions',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'transaction_id',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'service_date',
      type: 'date',
      required: true,
    },
    {
      name: 'event_timestamp',
      type: 'text',
      required: true,
    },
    {
      name: 'location_ping_id',
      type: 'text',
    },
    {
      name: 'amount',
      type: 'real',
      required: true,
    },
    {
      name: 'currency_type',
      type: 'text',
    },
    {
      name: 'fare_action',
      type: 'text',
      required: true,
    },
    {
      name: 'trip_id_performed',
      type: 'text',
    },
    {
      name: 'trip_id_scheduled',
      type: 'text',
    },
    {
      name: 'pattern_id',
      type: 'text',
    },
    {
      name: 'trip_stop_sequence',
      type: 'integer',
      min: 1,
    },
    {
      name: 'scheduled_stop_sequence',
      type: 'integer',
      min: 0,
    },
    {
      name: 'vehicle_id',
      type: 'text',
    },
    {
      name: 'device_id',
      type: 'text',
    },
    {
      name: 'fare_id',
      type: 'text',
    },
    {
      name: 'stop_id',
      type: 'text',
    },
    {
      name: 'num_riders',
      type: 'integer',
      min: 0,
    },
    {
      name: 'fare_media_id',
      type: 'text',
    },
    {
      name: 'rider_category',
      type: 'text',
    },
    {
      name: 'fare_product',
      type: 'text',
    },
    {
      name: 'fare_period',
      type: 'text',
    },
    {
      name: 'fare_capped',
      type: 'text',
      required: true,
    },
    {
      name: 'token_id',
      type: 'text',
    },
    {
      name: 'balance',
      type: 'real',
    },
  ],
};
