const model = {
  filenameBase: 'trips_dated_vehicle_journeys',
  nonstandard: true,
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'operating_day_date',
      type: 'varchar(255)',
      index: true,
      required: true,
    },
    {
      name: 'dated_vehicle_journey_gid',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'journey_number',
      type: 'integer',
      min: 0,
      max: 65535,
      index: true,
    },
  ],
};

export default model;
