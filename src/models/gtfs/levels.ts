export const levels = {
  filenameBase: 'levels',
  filenameExtension: 'txt',
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
