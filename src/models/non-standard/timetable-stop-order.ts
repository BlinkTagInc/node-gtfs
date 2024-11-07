export const timetableStopOrder = {
  filenameBase: 'timetable_stop_order',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'timetable_id',
      type: 'text',
      index: true,
      prefix: true,
      required: true,
      primary: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      prefix: true,
      required: true,
      primary: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      min: 0,
      index: true,
      required: true,
      primary: true,
    },
  ],
};
