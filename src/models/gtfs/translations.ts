export const translations = {
  filenameBase: 'translations',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'table_name',
      type: 'text',
      primary: true,
      required: true,
    },
    {
      name: 'field_name',
      type: 'text',
      primary: true,
      required: true,
    },
    {
      name: 'language',
      type: 'text',
      primary: true,
      required: true,
    },
    {
      name: 'translation',
      type: 'text',
      required: true,
    },
    {
      name: 'record_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'record_sub_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'field_value',
      type: 'text',
      primary: true,
    },
  ],
};
