export const fareRules = {
  filenameBase: 'fare_rules',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'fare_id',
      type: 'text',
      required: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'origin_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'destination_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'contains_id',
      type: 'text',
      prefix: true,
    },
  ],
};
