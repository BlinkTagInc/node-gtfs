export const timetableNotesReferences = {
  filenameBase: 'timetable_notes_references',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'note_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'timetable_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
    {
      name: 'show_on_stoptime',
      type: 'integer',
      min: 0,
      max: 1,
    },
  ],
};
