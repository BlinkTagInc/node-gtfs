const model = {
  filenameBase: 'directions',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'route_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
      primary: true,
    },
    {
      name: 'direction',
      type: 'varchar(255)',
      required: true,
    },
  ],
};

export default model;
