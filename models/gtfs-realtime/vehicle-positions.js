const model = {
  filenameBase: 'vehicle_positions',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'update_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      index: true,
      source: 'id',
    },
    {
      name: 'bearing',
      type: 'real',
      source: 'vehicle.position.bearing',
      default: null,
    },
    {
      name: 'latitude',
      type: 'real',
      min: -90,
      max: 90,
      source: 'vehicle.position.latitude',
      default: null,
    },
    {
      name: 'longitude',
      type: 'real',
      source: 'vehicle.position.longitude',
      min: -180,
      max: 180,
      default: null,
    },
    {
      name: 'speed',
      type: 'real',
      min: 0,
      source: 'vehicle.position.speed',
      default: null,
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      index: true,
      source: 'vehicle.trip.tripId',
      default: null,
    },
    {
      name: 'vehicle_id',
      type: 'varchar(255)',
      index: true,
      source: 'vehicle.vehicle.id',
      default: null,
    },
    {
      name: 'timestamp',
      type: 'varchar(255)',
      source: 'vehicle.timestamp',
      default: null,
    },
    {
      name: 'isUpdated',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};

export default model;
