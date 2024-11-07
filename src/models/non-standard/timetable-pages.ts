export const timetablePages = {
  filenameBase: 'timetable_pages',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'timetable_page_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'timetable_page_label',
      type: 'text',
    },
    {
      name: 'filename',
      type: 'text',
    },
  ],
};
