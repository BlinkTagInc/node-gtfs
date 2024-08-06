export const runEvents = {
  filenameBase: 'run_event',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'run_event_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'piece_id',
      type: 'text',
      required: true,
      prefix: true,
    },
    {
      name: 'event_type',
      type: 'integer',
      required: true,
      min: 0,
      index: true,
    },
    {
      name: 'event_name',
      type: 'text',
      nocase: true,
    },
    {
      name: 'event_time',
      type: 'text',
      required: true,
    },
    {
      name: 'event_duration',
      type: 'integer',
      required: true,
      min: 0,
    },
    {
      name: 'event_from_location_type',
      type: 'integer',
      min: 0,
      max: 1,
      index: true,
    },
    {
      name: 'event_from_location_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'event_to_location_type',
      type: 'integer',
      min: 0,
      max: 1,
      index: true,
    },
    {
      name: 'event_to_location_id',
      type: 'text',
      prefix: true,
    },
  ],
};
