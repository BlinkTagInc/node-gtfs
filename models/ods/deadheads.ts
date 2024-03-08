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
      prefix: true,
    },
    {
      name: 'service_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
    },
    {
      name: 'block_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'shape_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'to_trip_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'from_trip_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'to_deadhead_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'from_deadhead_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
  ],
};

export default model;
