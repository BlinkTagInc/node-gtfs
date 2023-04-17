const model = {
  filenameBase: 'calendar_attributes',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'service_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'service_description',
      type: 'varchar(255)',
      required: true,
      nocase: true,
    },
  ],
};

export default model;
