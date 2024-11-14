export const frequencies = {
  filenameBase: 'frequencies',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'trip_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'start_time',
      type: 'time',
      required: true,
      primary: true,
    },
    {
      name: 'end_time',
      type: 'time',
      required: true,
    },
    {
      name: 'headway_secs',
      type: 'integer',
      required: true,
      min: 0,
    },
    {
      name: 'exact_times',
      type: 'integer',
      min: 0,
      max: 1,
    },
  ],
};
