const model = {
  filenameBase: 'fare_leg_rules',
  schema: [
    {
      name: 'leg_group_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'network_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'from_area_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'to_area_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'fare_product_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
  ],
};

export default model;
