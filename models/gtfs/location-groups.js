const model = {
  filenameBase: 'location_groups',
  schema: [
    {
      name: 'location_group_id',
      type: 'varchar(255)',
      primary: true,
      prefix: true,
    },
    {
      name: 'location_group_name',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
