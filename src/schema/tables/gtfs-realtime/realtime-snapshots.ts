import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Immutable fetched FeedMessage plus transport and FeedHeader metadata. */
export const realtimeSnapshots = defineGtfsDomainTable({
  filename: null,
  tableName: 'realtime_snapshots',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'snapshot_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    snapshot_id: { kind: 'id', presence: 'required' },
    fetched_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    http_status: { kind: 'integer', minimum: 100, maximum: 599 },
    http_headers: { kind: 'json' },
    content_type: { kind: 'text' },
    feed_header_version: {
      kind: 'text',
      sourcePath: 'header.gtfsRealtimeVersion',
    },
    feed_header_incrementality: {
      kind: 'enumeration',
      values: ['FULL_DATASET', 'DIFFERENTIAL'],
      sourcePath: 'header.incrementality',
    },
    feed_header_unix_seconds: {
      kind: 'integer',
      minimum: 0,
      sourcePath: 'header.timestamp',
    },
    entity_count: { kind: 'integer', presence: 'required', minimum: 0 },
    payload_sha256: { kind: 'text', presence: 'required' },
    raw_payload: { kind: 'text', presence: 'required' },
    raw_payload_encoding: {
      kind: 'enumeration',
      values: ['base64'],
      closed: true,
      presence: 'required',
    },
    retention_expires_at_unix_seconds: {
      kind: 'integer',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
