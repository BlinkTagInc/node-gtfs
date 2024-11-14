export const stopAreas = {
  filenameBase: 'stop_areas',
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
      name: 'stop_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
  ],
};
