const model = {
  filenameBase: 'location_group_stops',
  schema: [
    {
      name: 'location_group_id',
      type: 'varchar(255)',
      prefix: true,
      index: true,
      required: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
      index: true,
    },
  ],
};

export default model;
