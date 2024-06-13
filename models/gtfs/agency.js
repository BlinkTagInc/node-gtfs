const model = {
  filenameBase: 'agency',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'agency_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'agency_name',
      type: 'text',
      required: true,
      nocase: true,
    },
    {
      name: 'agency_url',
      type: 'text',
      required: true,
    },
    {
      name: 'agency_timezone',
      type: 'text',
      required: true,
    },
    {
      name: 'agency_lang',
      type: 'text',
      nocase: true,
    },
    {
      name: 'agency_phone',
      type: 'text',
      nocase: true,
    },
    {
      name: 'agency_fare_url',
      type: 'text',
    },
    {
      name: 'agency_email',
      type: 'text',
      nocase: true,
    },
  ],
};

export default model;
