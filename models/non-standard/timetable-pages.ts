const model = {
  filenameBase: 'timetable_pages',
  nonstandard: true,
  schema: [
    {
      name: 'timetable_page_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'timetable_page_label',
      type: 'varchar(255)',
    },
    {
      name: 'filename',
      type: 'varchar(255)',
    },
  ],
};

export default model;
