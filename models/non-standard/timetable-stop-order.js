module.exports = {
  filenameBase: 'timetable_stop_order',
  nonstandard: true,
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'timetable_id',
      type: 'varchar(255)',
      index: true
    },
    {
      name: 'stop_id',
      type: 'varchar(255)'
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      min: 0,
      index: true
    }
  ]
};
