import type {
  NormalizedRealtimeRow,
  RealtimeSnapshotApplication,
  RealtimeSnapshotEntity,
} from '../../realtime/writer.ts';

export function createRealtimeSnapshotRow(
  snapshot: RealtimeSnapshotApplication,
): NormalizedRealtimeRow {
  return {
    source_id: snapshot.sourceId,
    realtime_feed_id: snapshot.realtimeFeedId,
    snapshot_id: snapshot.snapshotId,
    fetched_at_unix_seconds: snapshot.fetchedAtUnixSeconds,
    http_status: snapshot.httpStatus,
    http_headers: snapshot.httpHeaders,
    content_type: snapshot.contentType,
    feed_header_version: snapshot.feedHeaderVersion,
    feed_header_incrementality: snapshot.feedHeaderIncrementality,
    feed_header_unix_seconds: snapshot.feedHeaderUnixSeconds,
    entity_count: snapshot.entities.length,
    payload_sha256: snapshot.payloadSha256,
    raw_payload: snapshot.rawPayloadBase64,
    raw_payload_encoding: 'base64',
    retention_expires_at_unix_seconds: snapshot.retentionExpiresAtUnixSeconds,
  };
}

export function createRealtimeFeedEntityRow(
  snapshot: RealtimeSnapshotApplication,
  entity: RealtimeSnapshotEntity,
): NormalizedRealtimeRow {
  return {
    source_id: snapshot.sourceId,
    realtime_feed_id: snapshot.realtimeFeedId,
    snapshot_id: snapshot.snapshotId,
    entity_ordinal: entity.entityOrdinal,
    entity_id: entity.entityId,
    entity_type: entity.entityType,
    is_deleted: entity.isDeleted ? 1 : 0,
    entity_json: entity.entityJson,
    recorded_at_unix_seconds: snapshot.fetchedAtUnixSeconds,
    retention_expires_at_unix_seconds: snapshot.retentionExpiresAtUnixSeconds,
  };
}
