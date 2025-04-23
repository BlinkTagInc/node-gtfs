export const devices = {
  filenameBase: 'devices',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'device_id',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'stop_id',
      type: 'text',
    },
    {
      name: 'vehicle_id',
      type: 'text',
    },
    {
      name: 'train_car_id',
      type: 'text',
    },
    {
      name: 'device_type',
      type: 'text',
    },
    {
      name: 'device_vendor',
      type: 'text',
    },
    {
      name: 'device_model',
      type: 'text',
    },
    {
      name: 'device_location',
      type: 'text',
    },
  ],
};
