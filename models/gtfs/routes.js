module.exports = {
  filenameBase: 'routes',
  schema: [
    {
      name: 'route_id',
      type: 'varchar(255)',
      primary: true
    },
    {
      name: 'agency_id',
      type: 'varchar(255)'
    },
    {
      name: 'route_short_name',
      type: 'varchar(255)'
    },
    {
      name: 'route_long_name',
      type: 'varchar(255)'
    },
    {
      name: 'route_desc',
      type: 'varchar(255)'
    },
    {
      name: 'route_type',
      type: 'integer',
      required: true,
      min: 0,
      max: 7
    },
    {
      name: 'route_url',
      type: 'varchar(1020)'
    },
    {
      name: 'route_color',
      type: 'varchar(255)'
    },
    {
      name: 'route_text_color',
      type: 'varchar(255)'
    },
    {
      name: 'route_sort_order',
      type: 'integer',
      min: 0
    },
    {
      name: 'continuous_pickup',
      type: 'integer',
      min: 0,
      max: 3
    },
    {
      name: 'continuous_drop_off',
      type: 'integer',
      min: 0,
      max: 3
    }
  ]
};
