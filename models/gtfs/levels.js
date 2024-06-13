const model = {
  filenameBase: 'levels',
  schema: [
    {
      name: 'level_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'level_index',
      type: 'real',
      required: true,
    },
    {
      name: 'level_name',
      type: 'text',
      nocase: true,
    },
  ],
};

export default model;
