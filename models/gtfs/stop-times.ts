const model = {
  filenameBase: 'stop_times',
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'arrival_time',
      type: 'varchar(255)',
    },
    {
      name: 'arrival_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'departure_time',
      type: 'varchar(255)',
    },
    {
      name: 'departure_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
      index: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      required: true,
      primary: true,
      min: 0,
    },
    {
      name: 'stop_headsign',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'pickup_type',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'drop_off_type',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'continuous_pickup',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'continuous_drop_off',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0,
    },
    {
      name: 'timepoint',
      type: 'integer',
      min: 0,
      max: 1,
    },
  ],
};

export default model;
