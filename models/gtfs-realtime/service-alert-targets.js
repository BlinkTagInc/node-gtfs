const model = {
  filenameBase: 'service_alert_targets',
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
