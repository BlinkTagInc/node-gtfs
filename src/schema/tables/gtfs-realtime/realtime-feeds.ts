import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Stable configuration identity for one GTFS-Realtime endpoint. */
export const realtimeFeeds = defineGtfsDomainTable({
  filename: null,
  tableName: 'realtime_feeds',
  presence: 'optional',
  primaryKey: ['realtime_feed_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    feed_type: {
      kind: 'enumeration',
      values: [
        'alerts',
        'tripUpdates',
        'vehiclePositions',
        'shapes',
        'stops',
        'tripModifications',
        'mixed',
      ],
      closed: true,
      presence: 'required',
    },
    feed_url: { kind: 'text', presence: 'required' },
    source_metadata: { kind: 'json' },
    created_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    updated_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
