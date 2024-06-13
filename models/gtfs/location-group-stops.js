const model = {
  filenameBase: 'location_group_stops',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'location_group_id',
      type: 'text',
      prefix: true,
      index: true,
      required: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      required: true,
      prefix: true,
      index: true,
    },
  ],
};

export default model;
