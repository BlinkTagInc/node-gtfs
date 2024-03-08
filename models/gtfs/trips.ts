const model = {
  filenameBase: 'trips',
  schema: [
    {
      name: 'route_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'trip_headsign',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'trip_short_name',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
      index: true,
    },
    {
      name: 'block_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'shape_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'wheelchair_accessible',
      type: 'integer',
      min: 0,
      max: 2,
    },
    {
      name: 'bikes_allowed',
      type: 'integer',
      min: 0,
      max: 2,
    },
  ],
};

export default model;
