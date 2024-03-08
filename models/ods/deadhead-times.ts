const model = {
  filenameBase: 'deadhead_times',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true,
      prefix: true,
    },
    {
      name: 'deadhead_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'arrival_time',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'arrival_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'departure_time',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'departure_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'ops_location_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'location_sequence',
      type: 'integer',
      required: true,
      min: 0,
      index: true,
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0,
    },
  ],
};

export default model;
