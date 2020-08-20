module.exports = {
  filenameBase: 'calendar_dates',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      index: true
    },
    {
      name: 'date',
      type: 'integer',
      required: true,
      index: true
    },
    {
      name: 'exception_type',
      type: 'integer',
      required: true,
      min: 1,
      max: 2,
      index: true
    },
    {
      name: 'holiday_name',
      type: 'varchar(255)'
    }
  ]
};
