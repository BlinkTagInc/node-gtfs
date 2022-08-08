const model = {
  filenameBase: 'fare_products',
  schema: [
    {
      name: 'fare_product_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
    },
    {
      name: 'fare_product_name',
      type: 'varchar(255)',
    },
    {
      name: 'amount',
      type: 'real',
      required: true,
    },
    {
      name: 'currency',
      type: 'varchar(255)',
      required: true,
    },
  ],
};

export default model;
