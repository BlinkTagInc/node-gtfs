import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Current GTFS Realtime TripModifications entities. */
export const tripModifications = defineGtfsDomainTable({
  filename: null,
  tableName: 'trip_modifications',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'entity_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    entity_id: { kind: 'id', presence: 'required', sourcePath: 'id' },
    selected_trips: {
      kind: 'json',
      sourcePath: 'tripModifications.selectedTrips',
    },
    start_times: {
      kind: 'json',
      sourcePath: 'tripModifications.startTimes',
    },
    service_dates: {
      kind: 'json',
      sourcePath: 'tripModifications.serviceDates',
    },
    modifications: {
      kind: 'json',
      sourcePath: 'tripModifications.modifications',
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
