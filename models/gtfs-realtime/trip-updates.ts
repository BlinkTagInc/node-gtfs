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
      name: 'trip_start_time',
      type: 'varchar(255)',
      source: 'tripUpdate.trip.startTime',
      default: null,
    },
    {
      name: 'direction_id',
      type: 'integer',
      source: 'tripUpdate.trip.directionId',
      default: null,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      index: true,
      source: 'tripUpdate.trip.routeId',
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
      name: 'schedule_relationship',
      type: 'varchar(255)',
      source: 'tripUpdate.trip.scheduleRelationship',
      default: null,
    },
    {
      name: 'is_updated',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};

export default model;
