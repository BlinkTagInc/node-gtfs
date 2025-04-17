export const riderCategories = {
  filenameBase: 'rider_categories',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'rider_category_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'rider_category_name',
      type: 'text',
      required: true,
    },
    {
      name: 'is_default_fare_category',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'eligibility_url',
      type: 'text',
    },
  ],
};
