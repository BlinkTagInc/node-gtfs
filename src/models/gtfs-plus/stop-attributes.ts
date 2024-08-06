export const stopAttributes = {
  filenameBase: 'stop_attributes',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'stop_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'accessibility_id',
      type: 'integer',
      min: 0,
    },
    {
      name: 'cardinal_direction',
      type: 'text',
    },
    {
      name: 'relative_position',
      type: 'text',
    },
    {
      name: 'stop_city',
      type: 'text',
      nocase: true,
    },
  ],
};
