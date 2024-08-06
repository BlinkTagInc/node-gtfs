export const transfers = {
  filenameBase: 'transfers',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'from_stop_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_stop_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'from_route_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_route_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'from_trip_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_trip_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'transfer_type',
      type: 'integer',
      min: 0,
      max: 5,
      default: 0,
    },
    {
      name: 'min_transfer_time',
      type: 'integer',
      min: 0,
    },
  ],
};
