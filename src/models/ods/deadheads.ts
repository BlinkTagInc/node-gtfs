export const deadheads = {
  filenameBase: 'deadheads',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'deadhead_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'service_id',
      type: 'text',
      required: true,
      prefix: true,
    },
    {
      name: 'block_id',
      type: 'text',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'shape_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'to_trip_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'from_trip_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'to_deadhead_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'from_deadhead_id',
      type: 'text',
      index: true,
      prefix: true,
    },
  ],
};
