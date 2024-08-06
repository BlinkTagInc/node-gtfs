export const routeNetworks = {
  filenameBase: 'route_networks',
  filenameExtension: 'txt',
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
