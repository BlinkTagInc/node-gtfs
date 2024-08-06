export const routeAttributes = {
  filenameBase: 'route_attributes',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'route_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'category',
      type: 'integer',
      min: 0,
      required: true,
    },
    {
      name: 'subcategory',
      type: 'integer',
      min: 101,
      required: true,
    },
    {
      name: 'running_way',
      type: 'integer',
      min: 1,
      required: true,
    },
  ],
};
