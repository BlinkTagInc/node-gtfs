const model = {
  filenameBase: 'agency',
  schema: [
    {
      name: 'agency_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'agency_name',
      type: 'varchar(255)',
      required: true,
      nocase: true,
    },
    {
      name: 'agency_url',
      type: 'varchar(2047)',
      required: true,
    },
    {
      name: 'agency_timezone',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'agency_lang',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'agency_phone',
      type: 'varchar(64)',
      nocase: true,
    },
    {
      name: 'agency_fare_url',
      type: 'varchar(2047)',
    },
    {
      name: 'agency_email',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
