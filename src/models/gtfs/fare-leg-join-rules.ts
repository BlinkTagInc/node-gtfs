export const fareLegJoinRules = {
  filenameBase: 'fare_leg_join_rules',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'from_network_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'to_network_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'from_stop_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_stop_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
  ],
};
