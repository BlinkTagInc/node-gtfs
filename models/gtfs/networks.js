const model = {
  filenameBase: 'networks',
  schema: [
    {
      name: 'network_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'network_name',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
