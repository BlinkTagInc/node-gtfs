export const vehicleLocations = {
  filenameBase: 'vehicle_locations',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'location_ping_id',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'service_date',
      type: 'date',
    },
    {
      name: 'event_timestamp',
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
      required: true,
    },
    {
      name: 'device_id',
      type: 'text',
    },
    {
      name: 'pattern_id',
      type: 'text',
    },
    {
      name: 'stop_id',
      type: 'text',
    },
    {
      name: 'current_status',
      type: 'text',
    },
    {
      name: 'latitude',
      type: 'real',
      min: -90,
      max: 90,
    },
    {
      name: 'longitude',
      type: 'real',
      min: -180,
      max: 180,
    },
    {
      name: 'gps_quality',
      type: 'text',
    },
    {
      name: 'heading',
      type: 'real',
      min: 0,
      max: 360,
    },
    {
      name: 'speed',
      type: 'real',
      min: 0,
    },
    {
      name: 'odometer',
      type: 'real',
      min: 0,
    },
    {
      name: 'schedule_deviation',
      type: 'integer',
    },
    {
      name: 'headway_deviation',
      type: 'integer',
    },
    {
      name: 'trip_type',
      type: 'text',
    },
    {
      name: 'schedule_relationship',
      type: 'text',
    },
  ],
};
