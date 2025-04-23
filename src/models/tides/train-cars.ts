export const trainCars = {
  filenameBase: 'train_cars',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'train_car_id',
      type: 'text',
      required: true,
      primary: true,
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
    {
      name: 'train_car_type',
      type: 'text',
    },
  ],
};
