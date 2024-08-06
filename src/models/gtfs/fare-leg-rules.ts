export const fareLegRules = {
  filenameBase: 'fare_leg_rules',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'leg_group_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'network_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'from_area_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_area_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'from_timeframe_group_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_timeframe_group_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'fare_product_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'rule_priority',
      type: 'integer',
      min: 0,
    },
  ],
};
