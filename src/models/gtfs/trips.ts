export const trips = {
  filenameBase: 'trips',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'route_id',
      type: 'text',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'service_id',
      type: 'text',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'trip_headsign',
      type: 'text',
      nocase: true,
    },
    {
      name: 'trip_short_name',
      type: 'text',
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
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'shape_id',
      type: 'text',
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
    {
      name: 'cars_allowed',
      type: 'integer',
      min: 0,
      max: 2,
    },
  ],
};
