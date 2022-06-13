const model = {
  filenameBase: 'trip_updates',
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
      name: 'vehicle_id',
      type: 'varchar(255)',
      index: true,
      source: 'tripUpdate.vehicle.id',
      default: null,
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      index: true,
      source: 'tripUpdate.trip.tripId',
      default: null,
    },
    {
      name: 'start_date',
      type: 'varchar(255)',
      source: 'tripUpdate.trip.startDate',
      default: null,
    },
    {
      name: 'timestamp',
      type: 'varchar(255)',
      source: 'tripUpdate.timestamp',
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
