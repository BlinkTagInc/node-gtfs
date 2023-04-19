const model = {
  filenameBase: 'board_alight',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      required: true,
      min: 0,
      index: true,
    },
    {
      name: 'record_use',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
      index: true,
    },
    {
      name: 'schedule_relationship',
      type: 'integer',
      min: 0,
      max: 8,
    },
    {
      name: 'boardings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'alightings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'current_load',
      type: 'integer',
      min: 0,
    },
    {
      name: 'load_count',
      type: 'integer',
      min: 0,
    },
    {
      name: 'load_type',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'rack_down',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'bike_boardings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_alightings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'ramp_used',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'ramp_boardings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'ramp_alightings',
      type: 'integer',
      min: 0,
    },
    {
      name: 'service_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'service_arrival_time',
      type: 'varchar(255)',
    },
    {
      name: 'service_arrival_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'service_departure_time',
      type: 'varchar(255)',
    },
    {
      name: 'service_departure_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'source',
      type: 'integer',
      min: 0,
      max: 4,
    },
  ],
};

export default model;
