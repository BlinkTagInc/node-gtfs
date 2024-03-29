const model = {
  filenameBase: 'timesframes',
  schema: [
    {
      name: 'timeframe_group_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'start_time',
      type: 'varchar(255)',
      default: null,
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
      default: null,
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
    },
  ],
};

export default model;
