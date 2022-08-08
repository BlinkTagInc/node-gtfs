const model = {
  filenameBase: 'stop_areas',
  schema: [
    {
      name: 'area_id',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      required: true,
    },
  ],
};

export default model;
