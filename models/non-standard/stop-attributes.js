const model = {
  filenameBase: 'stop_attributes',
  nonstandard: true,
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
      index: true,
    },
    {
      name: 'stop_city',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
