import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Immutable FeedEntity envelope retained in snapshot order. */
export const realtimeFeedEntities = defineGtfsDomainTable({
  filename: null,
  tableName: 'realtime_feed_entities',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'snapshot_id', 'entity_ordinal'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    snapshot_id: { kind: 'id', presence: 'required' },
    entity_ordinal: { kind: 'integer', presence: 'required', minimum: 0 },
    entity_id: { kind: 'id', sourcePath: 'id' },
    entity_type: {
      kind: 'enumeration',
      values: [
        'alert',
        'trip_update',
        'vehicle_position',
        'shape',
        'stop',
        'trip_modifications',
        'unknown',
      ],
      presence: 'required',
    },
    is_deleted: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
      presence: 'required',
      defaultValue: 0,
      sourcePath: 'isDeleted',
    },
    entity_json: { kind: 'json', presence: 'required' },
    recorded_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    retention_expires_at_unix_seconds: {
      kind: 'integer',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
