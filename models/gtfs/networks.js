const model = {
  filenameBase: 'networks',
  schema: [
    {
      name: 'network_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'network_name',
      type: 'text',
      nocase: true,
    },
  ],
};

export default model;
