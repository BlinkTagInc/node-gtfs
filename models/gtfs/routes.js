const model = {
  filenameBase: 'routes',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'route_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'agency_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'route_short_name',
      type: 'text',
      nocase: true,
    },
    {
      name: 'route_long_name',
      type: 'text',
      nocase: true,
    },
    {
      name: 'route_desc',
      type: 'text',
      nocase: true,
    },
    {
      name: 'route_type',
      type: 'integer',
      required: true,
      min: 0,
      // Support extended GTFS route types with no max value
      // https://developers.google.com/transit/gtfs/reference/extended-route-types
    },
    {
      name: 'route_url',
      type: 'text',
    },
    {
      name: 'route_color',
      type: 'text',
      nocase: true,
    },
    {
      name: 'route_text_color',
      type: 'text',
      nocase: true,
    },
    {
      name: 'route_sort_order',
      type: 'integer',
      min: 0,
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
      name: 'network_id',
      type: 'text',
      prefix: true,
    },
  ],
};

export default model;
