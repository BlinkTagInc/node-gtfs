export const serviceAlertInformedEntities = {
  filenameBase: 'service_alert_informed_entities',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'alert_id',
      type: 'text',
      required: true,
      primary: true,
      source: 'parent.id',
    },
    {
      name: 'stop_id',
      type: 'text',
      index: true,
      source: 'stopId',
      default: null,
    },
    {
      name: 'route_id',
      type: 'text',
      index: true,
      source: 'routeId',
      default: null,
    },
    {
      name: 'route_type',
      type: 'integer',
      index: true,
      source: 'routeType',
      default: null,
    },
    {
      name: 'trip_id',
      type: 'text',
      index: true,
      source: 'trip.tripId',
      default: null,
    },
    {
      name: 'direction_id',
      type: 'integer',
      index: true,
      source: 'directionId',
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
