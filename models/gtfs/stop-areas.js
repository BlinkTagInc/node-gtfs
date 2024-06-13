const model = {
  filenameBase: 'stop_areas',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'area_id',
      type: 'text',
      required: true,
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      required: true,
      prefix: true,
    },
  ],
};

export default model;
