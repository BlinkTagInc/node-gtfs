const model = {
  filenameBase: 'service_alert_targets',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'alert_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      source: 'parent.id',
    },
    {
      name: 'stop_id',
      type: 'varchar(255)',
      index: true,
      source: 'stopId',
      default: null,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
      index: true,
      source: 'routeId',
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
