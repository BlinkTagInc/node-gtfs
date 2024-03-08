const model = {
  filenameBase: 'frequencies',
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'start_time',
      type: 'varchar(255)',
      required: true,
      primary: true,
    },
    {
      name: 'start_timestamp',
      type: 'integer',
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'end_timestamp',
      type: 'integer',
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

export default model;
