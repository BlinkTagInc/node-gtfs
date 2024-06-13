const model = {
  filenameBase: 'timeframes',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'timeframe_group_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'start_time',
      type: 'text',
    },
    {
      name: 'end_time',
      type: 'text',
    },
    {
      name: 'service_id',
      type: 'text',
      required: true,
      index: true,
      prefix: true,
    },
  ],
};

export default model;
