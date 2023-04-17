const model = {
  filenameBase: 'route_attributes',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'route_id',
      type: 'varchar(255)',
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

export default model;
