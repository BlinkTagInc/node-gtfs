const model = {
  filenameBase: 'deadheads',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'deadhead_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'block_id',
      type: 'varchar(255)',
      required: true,
      index: true,
    },
    {
      name: 'shape_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'to_trip_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'from_trip_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'to_deadhead_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'from_deadhead_id',
      type: 'varchar(255)',
      index: true,
    },
  ],
};

export default model;
