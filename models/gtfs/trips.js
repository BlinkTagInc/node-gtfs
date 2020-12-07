module.exports = {
  filenameBase: 'trips',
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      primary: true
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      required: true,
      index: true
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      index: true
    },
    {
      name: 'trip_headsign',
      type: 'varchar(255)'
    },
    {
      name: 'trip_short_name',
      type: 'varchar(255)'
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
      index: true
    },
    {
      name: 'block_id',
      type: 'varchar(255)',
      index: true
    },
    {
      name: 'shape_id',
      type: 'varchar(255)',
      index: true
    },
    {
      name: 'wheelchair_accessible',
      type: 'integer',
      min: 0,
      max: 2
    },
    {
      name: 'bikes_allowed',
      type: 'integer',
      min: 0,
      max: 2
    }
  ]
};
