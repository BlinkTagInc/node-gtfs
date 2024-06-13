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
