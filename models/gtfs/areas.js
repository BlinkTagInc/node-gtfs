const model = {
  filenameBase: 'areas',
  schema: [
    {
      name: 'area_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
    },
    {
      name: 'area_name',
      type: 'varchar(255)',
    },
  ],
};

export default model;
