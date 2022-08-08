const model = {
  filenameBase: 'fare_transfer_rules',
  schema: [
    {
      name: 'from_leg_group_id',
      type: 'varchar(255)',
    },
    {
      name: 'to_leg_group_id',
      type: 'varchar(255)',
    },
    {
      name: 'transfer_count',
      type: 'integer',
      min: -1,
    },
    {
      name: 'transfer_id',
      type: 'varchar(255)',
    },
    {
      name: 'duration_limit',
      type: 'integer',
      min: 0,
    },
    {
      name: 'duration_limit_type',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'fare_transfer_type',
      type: 'integer',
      min: 0,
      max: 2,
    },
    {
      name: 'fare_product_id',
      type: 'varchar(255)',
    },
  ],
};

export default model;
