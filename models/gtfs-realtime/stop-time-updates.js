const model = {
  filenameBase: 'stop_time_updates',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'trip_id',
      type: 'text',
      index: true,
      source: 'parent.tripUpdate.trip.tripId',
      default: null,
    },
    {
      name: 'trip_start_time',
      type: 'text',
      source: 'parent.tripUpdate.trip.startTime',
      default: null,
    },
    {
      name: 'direction_id',
      type: 'integer',
      source: 'parent.tripUpdate.trip.directionId',
      default: null,
    },
    {
      name: 'route_id',
      type: 'text',
      index: true,
      source: 'parent.tripUpdate.trip.routeId',
      default: null,
    },
    {
      name: 'stop_id',
      type: 'text',
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
      type: 'text',
      source: 'departure.time',
      default: null,
    },
    {
      name: 'arrival_timestamp',
      type: 'text',
      source: 'arrival.time',
      default: null,
    },
    {
      name: 'schedule_relationship',
      type: 'text',
      source: 'scheduleRelationship',
      default: null,
    },
    {
      name: 'created_timestamp',
      type: 'integer',
      required: true,
    },
    {
      name: 'expiration_timestamp',
      type: 'integer',
      required: true,
    },
  ],
};

export default model;
