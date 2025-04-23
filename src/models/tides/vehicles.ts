export const vehicles = {
  filenameBase: 'vehicles',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'vehicle_id',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'vehicle_start',
      type: 'text',
    },
    {
      name: 'vehicle_end',
      type: 'text',
    },
    {
      name: 'model_name',
      type: 'text',
    },
    {
      name: 'facility_name',
      type: 'text',
    },
    {
      name: 'capacity_seated',
      type: 'integer',
      min: 0,
    },
    {
      name: 'capacity_wheelchair',
      type: 'integer',
      min: 0,
    },
    {
      name: 'capacity_bike',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_rack',
      type: 'text',
    },
    {
      name: 'capacity_standing',
      type: 'integer',
      min: 0,
    },
  ],
};
