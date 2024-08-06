export const fareMedia = {
  filenameBase: 'fare_media',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'fare_media_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'fare_media_name',
      type: 'text',
    },
    {
      name: 'fare_media_type',
      type: 'integer',
      required: true,
      min: 0,
      max: 4,
    },
  ],
};
