export const tripsDatedVehicleJourney = {
  filenameBase: 'trips_dated_vehicle_journey',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'trip_id',
      type: 'text',
      required: true,
      index: true,
      prefix: true,
    },
    {
      name: 'operating_day_date',
      type: 'text',
      index: true,
      required: true,
    },
    {
      name: 'dated_vehicle_journey_gid',
      type: 'text',
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
