const model = {
  filenameBase: 'trip_updates',
  extension: 'gtfs-rt',
  schema: [
    {
      name: 'update_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      index: true,
      source: 'entity.id'
    },
    {
      name: 'vehicle_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      source: 'entity.tripUpdate.vehicle.id'
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      index: true,
      source: 'entity.tripUpdate.trip.tripId'
    },
    {
      name: 'start_date',
      type: 'varchar(255)',
      required: true,
      index: true,
      source: 'entity.tripUpdate.trip.startDate'
    },
  ],
};

export default model;
