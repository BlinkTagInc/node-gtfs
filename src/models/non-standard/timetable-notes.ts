export const timetableNotes = {
  filenameBase: 'timetable_notes',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'note_id',
      type: 'text',
      prefix: true,
      required: true,
      primary: true,
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
    /*
     * What the note is attached to, which says how the id columns below are
     * read: `timetable`, `route`, `trip`, `trip_stoptimes`, `stop`,
     * `stop_stoptimes` or `stoptime`.
     */
    {
      name: 'scope',
      type: 'text',
      primary: true,
    },
    {
      name: 'timetable_id',
      type: 'text',
      prefix: true,
      primary: true,
    },
    {
      name: 'route_id',
      type: 'text',
      prefix: true,
      primary: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      prefix: true,
      primary: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      prefix: true,
      primary: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      min: 0,
      primary: true,
    },
  ],
};
