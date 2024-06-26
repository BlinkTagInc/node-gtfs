const model = {
  filenameBase: 'areas',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'area_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'area_name',
      type: 'text',
    },
  ],
};

export default model;
