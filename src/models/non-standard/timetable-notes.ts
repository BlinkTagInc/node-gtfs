export const timetableNotes = {
  filenameBase: 'timetable_notes',
  filenameExtension: 'txt',
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
