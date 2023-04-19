const model = {
  filenameBase: 'fare_attributes',
  schema: [
    {
      name: 'fare_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'price',
      type: 'real',
      required: true,
    },
    {
      name: 'currency_type',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'payment_method',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'transfers',
      type: 'integer',
      min: 0,
      max: 2,
    },
    {
      name: 'agency_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'transfer_duration',
      type: 'integer',
      min: 0,
    },
  ],
};

export default model;
