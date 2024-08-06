export const fareAttributes = {
  filenameBase: 'fare_attributes',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'fare_id',
      type: 'text',
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
      type: 'text',
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
      type: 'text',
      prefix: true,
    },
    {
      name: 'transfer_duration',
      type: 'integer',
      min: 0,
    },
  ],
};
