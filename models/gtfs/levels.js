const model = {
  filenameBase: 'levels',
  schema: [
    {
      name: 'level_id',
      type: 'varchar(255)',
      primary: true
    },
    {
      name: 'level_index',
      type: 'real',
      required: true
    },
    {
      name: 'level_name',
      type: 'varchar(255)'
    }
  ]
};

export default model;
