const model = {
  filenameBase: 'route_networks',
  schema: [
    {
      name: 'network_id',
      type: 'text',
      required: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      primary: true,
      index: true,
      prefix: true,
    },
  ],
};

export default model;
