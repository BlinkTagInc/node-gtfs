const model = {
  filenameBase: 'timetable_pages',
  nonstandard: true,
  schema: [
    {
      name: 'timetable_page_id',
      type: 'text',
      primary: true,
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

export default model;
