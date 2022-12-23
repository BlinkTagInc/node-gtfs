const model = {
  filenameBase: 'transfers',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true,
    },
    {
      name: 'from_stop_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'to_stop_id',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'from_route_id',
      type: 'varchar(255)',
    },
    {
      name: 'to_route_id',
      type: 'varchar(255)',
    },
    {
      name: 'from_trip_id',
      type: 'varchar(255)',
    },
    {
      name: 'to_trip_id',
      type: 'varchar(255)',
    },
    {
      name: 'transfer_type',
      type: 'integer',
      min: 0,
      max: 5,
      required: false,
      default: 0
    },
    {
      name: 'min_transfer_time',
      type: 'integer',
      min: 0,
    },
  ],
};

export default model;
