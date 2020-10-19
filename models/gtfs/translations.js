module.exports = {
  filenameBase: 'translations',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'table_name',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'field_name',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'language',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'translation',
      type: 'varchar(2047)',
      required: true
    },
    {
      name: 'record_id',
      type: 'varchar(255)'
    },
    {
      name: 'record_sub_id',
      type: 'varchar(255)'
    },
    {
      name: 'field_value',
      type: 'varchar(2047)'
    }
  ]
};
