export const directions = {
  filenameBase: 'directions',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'route_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
      primary: true,
    },
    {
      name: 'direction',
      type: 'text',
      required: true,
    },
  ],
};
