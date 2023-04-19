const model = {
  filenameBase: 'run_event',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'run_event_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'piece_id',
      type: 'varchar(255)',
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
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'event_time',
      type: 'varchar(255)',
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
      type: 'varchar(255)',
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
      type: 'varchar(255)',
      prefix: true,
    },
  ],
};

export default model;
