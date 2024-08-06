export const serviceAlertTargets = {
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
