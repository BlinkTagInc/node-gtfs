const model = {
  filenameBase: 'fare_transfer_rules',
  schema: [
    {
      name: 'from_leg_group_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_leg_group_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'transfer_count',
      type: 'integer',
      min: -1,
      primary: true,
    },
    {
      name: 'transfer_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'duration_limit',
      type: 'integer',
      min: 0,
      primary: true,
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
      required: true,
    },
    {
      name: 'fare_product_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
  ],
};

export default model;
