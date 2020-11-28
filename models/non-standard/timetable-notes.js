module.exports = {
  filenameBase: 'timetable_notes',
  nonstandard: true,
  schema: [
    {
      name: 'note_id',
      type: 'varchar(255)',
      primary: true
    },
    {
      name: 'symbol',
      type: 'varchar(255)'
    },
    {
      name: 'note',
      type: 'varchar(2047)'
    }
  ]
};
