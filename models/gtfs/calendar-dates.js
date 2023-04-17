const model = {
  filenameBase: 'calendar_dates',
  schema: [
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'date',
      type: 'integer',
      required: true,
      primary: true,
    },
    {
      name: 'exception_type',
      type: 'integer',
      required: true,
      min: 1,
      max: 2,
      index: true,
    },
    {
      name: 'holiday_name',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
