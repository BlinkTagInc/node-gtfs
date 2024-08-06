export const tripCapacity = {
  filenameBase: 'trip_capacity',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-ride',
  schema: [
    {
      name: 'agency_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'service_date',
      type: 'date',
      index: true,
    },
    {
      name: 'vehicle_description',
      type: 'text',
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
