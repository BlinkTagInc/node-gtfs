import { defineGtfsTable } from '../../define-table.ts';

export const serviceAlertInformedEntities = defineGtfsTable({
  file: null,
  table: 'service_alert_informed_entities',
  presence: 'optional',
  primaryKey: [
    'alert_id',
    'agency_id',
    'stop_id',
    'route_id',
    'route_type',
    'trip_id',
    'direction_id',
  ],
  fields: {
    alert_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'parent.id',
      applyFeedPrefix: true,
    },
    agency_id: {
      kind: 'id',
      references: [{ file: 'agency.txt', field: 'agency_id' }],
      sourcePath: 'agencyId',
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      sourcePath: 'stopId',
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      sourcePath: 'routeId',
      applyFeedPrefix: true,
    },
    route_type: { kind: 'integer', sourcePath: 'routeType' },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      sourcePath: 'trip.tripId',
      applyFeedPrefix: true,
    },
    direction_id: { kind: 'integer', sourcePath: 'directionId' },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  namespace: 'gtfs-realtime',
});
