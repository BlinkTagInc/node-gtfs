const model = {
  filenameBase: 'timetable_stop_order',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true,
      prefix: true,
    },
    {
      name: 'timetable_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
  ],
};

export default model;
