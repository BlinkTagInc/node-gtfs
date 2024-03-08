const model = {
  filenameBase: 'fare_rules',
  schema: [
    {
      name: 'fare_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'origin_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'destination_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'contains_id',
      type: 'varchar(255)',
      prefix: true,
    },
  ],
};

export default model;
