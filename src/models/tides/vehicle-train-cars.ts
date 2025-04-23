export const vehicleTrainCars = {
  filenameBase: 'vehicle_train_cars',
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
      name: 'train_car_id',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'train_car_order',
      type: 'integer',
      min: 0,
    },
    {
      name: 'operator_id',
      type: 'text',
    },
  ],
};
