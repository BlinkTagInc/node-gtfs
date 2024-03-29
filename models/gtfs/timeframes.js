const model = {
  filenameBase: 'timeframes',
  schema: [
    {
      name: 'timeframe_group_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'start_time',
      type: 'varchar(255)',
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
  ],
};

export default model;
