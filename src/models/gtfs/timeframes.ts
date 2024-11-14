export const timeframes = {
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
      type: 'time',
      primary: true,
    },
    {
      name: 'end_time',
      type: 'time',
      primary: true,
    },
    {
      name: 'service_id',
      type: 'text',
      required: true,
      primary: true,
      index: true,
      prefix: true,
    },
  ],
};
