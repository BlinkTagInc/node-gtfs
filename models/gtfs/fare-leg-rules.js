const model = {
  filenameBase: 'fare_leg_rules',
  schema: [
    {
      name: 'leg_group_id',
      type: 'varchar(255)',
    },
    {
      name: 'network_id',
      type: 'varchar(255)',
    },
    {
      name: 'from_area_id',
      type: 'varchar(255)',
    },
    {
      name: 'to_area_id',
      type: 'varchar(255)',
    },
    {
      name: 'fare_product_id',
      type: 'varchar(255)',
      required: true,
    },
  ],
};

export default model;
