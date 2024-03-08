const model = {
  filenameBase: 'timetable_stop_order',
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
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
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
