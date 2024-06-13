const model = {
  filenameBase: 'ridership',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'total_boardings',
      type: 'integer',
      min: 0,
      required: true,
    },
    {
      name: 'total_alightings',
      type: 'integer',
      min: 0,
      required: true,
    },
    {
      name: 'ridership_start_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'ridership_end_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'ridership_start_time',
      type: 'text',
    },
    {
      name: 'ridership_start_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'ridership_end_time',
      type: 'text',
    },
    {
      name: 'ridership_end_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'service_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'monday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'tuesday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'wednesday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'thursday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'friday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'saturday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'sunday',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'agency_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
      index: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      prefix: true,
    },
  ],
};

export default model;
