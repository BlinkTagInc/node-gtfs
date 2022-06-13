const model = {
  filenameBase: 'stop_times_updates',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'trip_id',
      type: 'varchar(255)',
      index: true,
      source: 'parent.tripUpdate.trip.tripId',
      default: null,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      index: true,
      source: 'parent.tripUpdate.trip.routeId',
      default: null,
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      index: true,
      source: 'stopId',
      default: null,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      source: 'stopSequence',
      default: null,
    },
    {
      name: 'arrival_delay',
      type: 'integer',
      source: 'arrival.delay',
      default: null,
    },
    {
      name: 'departure_delay',
      type: 'integer',
      source: 'departure.delay',
      default: null,
    },
    {
      name: 'departure_timestamp',
      type: 'varchar(255)',
      source: 'departure.time',
      default: null,
    },
    {
      name: 'arrival_timestamp',
      type: 'varchar(255)',
      source: 'arrival.time',
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
