import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Query-oriented Alert.informed_entity rows in protobuf order. */
export const alertEntitySelectors = defineGtfsDomainTable({
  filename: null,
  tableName: 'alert_entity_selectors',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'alert_id', 'selector_ordinal'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    alert_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'parent.id',
    },
    selector_ordinal: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    agency_id: {
      kind: 'id',
      references: [{ targetFilename: 'agency.txt', targetField: 'agency_id' }],
      sourcePath: 'agencyId',
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      sourcePath: 'stopId',
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
      sourcePath: 'routeId',
    },
    route_type: { kind: 'integer', minimum: 0, sourcePath: 'routeType' },
    trip_id: { kind: 'id', sourcePath: 'trip.tripId' },
    trip_route_id: { kind: 'id', sourcePath: 'trip.routeId' },
    trip_direction_id: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
      sourcePath: 'trip.directionId',
    },
    trip_start_time: { kind: 'text', sourcePath: 'trip.startTime' },
    trip_start_date: { kind: 'text', sourcePath: 'trip.startDate' },
    trip_schedule_relationship: {
      kind: 'enumeration',
      values: [
        'SCHEDULED',
        'ADDED',
        'UNSCHEDULED',
        'CANCELED',
        'REPLACEMENT',
        'DUPLICATED',
        'DELETED',
        'NEW',
      ],
      sourcePath: 'trip.scheduleRelationship',
    },
    trip_modified_trip_modifications_id: {
      kind: 'id',
      sourcePath: 'trip.modifiedTrip.modificationsId',
    },
    trip_modified_trip_affected_trip_id: {
      kind: 'id',
      sourcePath: 'trip.modifiedTrip.affectedTripId',
    },
    trip_modified_trip_start_time: {
      kind: 'text',
      sourcePath: 'trip.modifiedTrip.startTime',
    },
    trip_modified_trip_start_date: {
      kind: 'text',
      sourcePath: 'trip.modifiedTrip.startDate',
    },
    direction_id: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
      sourcePath: 'directionId',
    },
    created_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    expires_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
