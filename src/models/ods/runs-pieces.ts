export const runsPieces = {
  filenameBase: 'runs_pieces',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'run_id',
      type: 'text',
      required: true,
    },
    {
      name: 'piece_id',
      type: 'text',
      primary: true,
      required: true,
    },
    {
      name: 'start_type',
      type: 'integer',
      required: true,
      min: 0,
      max: 2,
      index: true,
    },
    {
      name: 'start_trip_id',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'start_trip_position',
      type: 'integer',
      min: 0,
    },
    {
      name: 'end_type',
      type: 'integer',
      required: true,
      min: 0,
      max: 2,
      index: true,
    },
    {
      name: 'end_trip_id',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'end_trip_position',
      type: 'integer',
      min: 0,
    },
  ],
};
