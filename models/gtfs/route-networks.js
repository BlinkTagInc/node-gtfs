const model = {
  filenameBase: 'route_networks',
  schema: [
    {
      name: 'network_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      primary: true,
      index: true,
      prefix: true,
    },
  ],
};

export default model;
