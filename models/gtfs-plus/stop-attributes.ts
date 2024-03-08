const model = {
  filenameBase: 'stop_attributes',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'accessibility_id',
      type: 'integer',
      min: 0,
    },
    {
      name: 'cardinal_direction',
      type: 'varchar(255)',
    },
    {
      name: 'relative_position',
      type: 'varchar(255)',
    },
    {
      name: 'stop_city',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
