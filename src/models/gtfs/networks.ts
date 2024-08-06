export const networks = {
  filenameBase: 'networks',
  filenameExtension: 'txt',
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
