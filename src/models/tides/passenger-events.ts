export const passengerEvents = {
  filenameBase: 'passenger_events',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'passenger_event_id',
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
      name: 'trip_id_performed',
      type: 'text',
    },
    {
      name: 'trip_id_scheduled',
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
      name: 'event_type',
      type: 'text',
      required: true,
    },
    {
      name: 'vehicle_id',
      type: 'text',
      required: true,
    },
    {
      name: 'device_id',
      type: 'text',
    },
    {
      name: 'train_car_id',
      type: 'text',
    },
    {
      name: 'stop_id',
      type: 'text',
    },
    {
      name: 'pattern_id',
      type: 'text',
    },
    {
      name: 'event_count',
      type: 'integer',
      min: 0,
    },
  ],
};
