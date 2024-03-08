const model = {
  filenameBase: 'trip_capacity',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'agency_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      index: true,
      prefix: true,
    },
    {
      name: 'service_date',
      type: 'integer',
      index: true,
    },
    {
      name: 'vehicle_description',
      type: 'varchar(255)',
    },
    {
      name: 'seated_capacity',
      type: 'integer',
      min: 0,
    },
    {
      name: 'standing_capacity',
      type: 'integer',
      min: 0,
    },
    {
      name: 'wheelchair_capacity',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_capacity',
      type: 'integer',
      min: 0,
    },
  ],
};

export default model;
