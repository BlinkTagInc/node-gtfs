const model = {
  filenameBase: 'timetable_notes',
  nonstandard: true,
  schema: [
    {
      name: 'note_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'symbol',
      type: 'text',
    },
    {
      name: 'note',
      type: 'text',
      nocase: true,
    },
  ],
};

export default model;
