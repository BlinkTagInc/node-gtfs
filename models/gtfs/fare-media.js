const model = {
  filenameBase: 'fare_media',
  schema: [
    {
      name: 'fare_media_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'fare_media_name',
      type: 'varchar(255)',
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

export default model;
