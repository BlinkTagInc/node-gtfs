export const fareProducts = {
  filenameBase: 'fare_products',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'fare_product_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'rider_category_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'fare_product_name',
      type: 'text',
    },
    {
      name: 'fare_media_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'amount',
      type: 'real',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
    },
  ],
};
