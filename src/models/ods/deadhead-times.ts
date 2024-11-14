export const deadheadTimes = {
  filenameBase: 'deadhead_times',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'deadhead_id',
      type: 'text',
      required: true,
      index: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'arrival_time',
      type: 'time',
      required: true,
    },
    {
      name: 'departure_time',
      type: 'time',
      required: true,
    },
    {
      name: 'ops_location_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'location_sequence',
      type: 'integer',
      required: true,
      primary: true,
      min: 0,
      index: true,
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0,
    },
  ],
};
