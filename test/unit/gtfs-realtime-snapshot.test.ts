import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';

import {
  GtfsValidationNoticeCode,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import {
  inferRealtimeFeedType,
  type FetchedRealtimeFeed,
  type RealtimeSnapshotContext,
} from '../../src/realtime/feed.ts';
import { createRealtimeSnapshotApplication } from '../../src/realtime/snapshot.ts';
import {
  createRealtimeFeedEntityRow,
  createRealtimeSnapshotRow,
} from '../../src/database/storage/realtime.ts';
import { GTFS_REALTIME_CURRENT_STATE_TABLES } from '../../src/realtime/entity-tables.ts';

const context: RealtimeSnapshotContext = {
  currentEntitiesSeconds: 60,
  snapshotsSeconds: 3_600,
  sourceId: 'source',
  nowUnixSeconds: 100,
  realtimeFeedId: 'mixed',
  feedUrl: 'https://example.test/realtime.pb',
};

function createFetchedFeed(
  incrementality: string,
  entity: FetchedRealtimeFeed['feed']['entity'],
): FetchedRealtimeFeed {
  return {
    contentType: 'application/x-protobuf',
    feed: {
      header: {
        gtfsRealtimeVersion: '2.0',
        incrementality,
        timestamp: 99,
      },
      entity,
    },
    rawPayload: Buffer.from(`${incrementality}:${entity.length}`),
    httpHeaders: { etag: 'test' },
    httpStatus: 200,
  };
}

describe('GTFS-Realtime snapshot construction', () => {
  test('bounds samples while delivering all entity and alert-period notices', () => {
    const delivered = new Map<string, number>();
    const { validation } = createRealtimeSnapshotApplication(
      createFetchedFeed('FULL_DATASET', [
        {
          id: 'alert',
          alert: {
            activePeriod: Array.from({ length: 250 }, () => ({
              start: 2,
              end: 1,
            })),
          },
        },
        ...Array.from({ length: 250 }, () => ({ id: '', alert: {} })),
      ]),
      {
        ...context,
        onNotice(notice) {
          delivered.set(notice.code, (delivered.get(notice.code) ?? 0) + 1);
        },
      },
    );
    assert.equal(validation.samples.length, 100);
    assert.equal(validation.truncated, true);
    assert.equal(
      validation.countsByCode[
        GtfsValidationNoticeCode.REALTIME_ALERT_PERIOD_INVALID
      ],
      250,
    );
    assert.equal(
      validation.countsByCode[
        GtfsValidationNoticeCode.REALTIME_ENTITY_ID_MISSING
      ],
      250,
    );
    assert.deepEqual(validation.countsByCode, Object.fromEntries(delivered));
  });

  for (const seconds of [
    0,
    60,
    Number.MAX_SAFE_INTEGER - context.nowUnixSeconds,
  ]) {
    test(`stores exact expiration timestamps for retention ${seconds}`, () => {
      const {
        snapshot,
        validation: { samples: notices },
      } = createRealtimeSnapshotApplication(
        createFetchedFeed('FULL_DATASET', [
          {
            id: 'alert',
            alert: {
              informedEntity: [{ routeId: 'route' }],
              activePeriod: [{ start: 1, end: 2 }],
            },
          },
        ]),
        {
          ...context,
          currentEntitiesSeconds: seconds,
          snapshotsSeconds: seconds,
        },
      );
      assert.deepEqual(notices, []);
      const expiresAt = context.nowUnixSeconds + seconds;
      assert.equal(snapshot.retentionExpiresAtUnixSeconds, expiresAt);
      const rows = snapshot.entities.flatMap(({ currentMutations }) =>
        currentMutations.filter((mutation) => mutation.operation === 'replace'),
      );
      assert.equal(rows.length, 3);
      for (const mutation of rows) {
        assert.equal(mutation.row.expires_at_unix_seconds, expiresAt);
      }
    });
  }

  test('preserves null as unlimited snapshot history', () => {
    const { snapshot } = createRealtimeSnapshotApplication(
      createFetchedFeed('FULL_DATASET', []),
      { ...context, snapshotsSeconds: null },
    );
    assert.equal(snapshot.retentionExpiresAtUnixSeconds, null);
  });

  for (const setting of [
    'currentEntitiesSeconds',
    'snapshotsSeconds',
  ] as const) {
    test(`rejects ${setting} overflow even for empty and history-only feeds`, () => {
      for (const incrementality of [
        'FULL_DATASET',
        'DIFFERENTIAL',
        'UNRECOGNIZED',
      ]) {
        for (const entities of [[], [{ id: 'alert', alert: {} }]]) {
          assert.throws(
            () =>
              createRealtimeSnapshotApplication(
                createFetchedFeed(incrementality, entities),
                {
                  ...context,
                  [setting]:
                    Number.MAX_SAFE_INTEGER - context.nowUnixSeconds + 1,
                },
              ),
            (error) => {
              assert.ok(isGtfsError(error));
              assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
              assert.equal(error.category, 'config');
              assert.deepEqual(error.details, {
                path: `realtime.retention.${setting}`,
                reason: 'invalid-value',
                retentionSeconds:
                  Number.MAX_SAFE_INTEGER - context.nowUnixSeconds + 1,
                nowUnixSeconds: context.nowUnixSeconds,
              });
              return true;
            },
          );
        }
      }
    });
  }

  for (const [payloadField, feedType] of [
    ['alert', 'alerts'],
    ['tripUpdate', 'tripUpdates'],
    ['vehicle', 'vehiclePositions'],
    ['shape', 'shapes'],
    ['stop', 'stops'],
    ['tripModifications', 'tripModifications'],
  ] as const) {
    test(`infers the configuration spelling ${feedType}`, () => {
      assert.equal(
        inferRealtimeFeedType([{ id: 'entity', [payloadField]: {} }]),
        feedType,
      );
    });
  }

  for (const { name, incrementality, extra, applies } of [
    { name: 'full', incrementality: 'FULL_DATASET', extra: {}, applies: true },
    {
      name: 'differential',
      incrementality: 'DIFFERENTIAL',
      extra: {},
      applies: true,
    },
    {
      name: 'history-only',
      incrementality: 'UNRECOGNIZED',
      extra: {},
      applies: false,
    },
    {
      name: 'missing ID',
      incrementality: 'DIFFERENTIAL',
      extra: { id: '' },
      applies: false,
    },
    {
      name: 'ambiguous payload',
      incrementality: 'DIFFERENTIAL',
      extra: { vehicle: {} },
      applies: false,
    },
    {
      name: 'tombstone',
      incrementality: 'DIFFERENTIAL',
      extra: { isDeleted: true },
      applies: false,
    },
  ]) {
    test(`inspects alert bounds once and preserves notices for ${name}`, () => {
      let inspections = 0;
      const entity = {
        id: 'alert',
        alert: {
          activePeriod: [
            {
              start: {
                toString() {
                  inspections += 1;
                  return '20';
                },
              },
              end: 10,
            },
          ],
        },
        ...extra,
      };
      const {
        validation: { samples: notices },
        snapshot,
      } = createRealtimeSnapshotApplication(
        createFetchedFeed(incrementality, [
          entity,
        ] as unknown as FetchedRealtimeFeed['feed']['entity']),
        context,
      );
      assert.equal(inspections, 1);
      const periodNotices = notices.filter(
        ({ code }) =>
          code === GtfsValidationNoticeCode.REALTIME_ALERT_PERIOD_INVALID,
      );
      assert.equal(periodNotices.length, 1);
      assert.deepEqual(periodNotices[0]?.position, {
        kind: 'realtime',
        entityNumber: 1,
      });
      assert.equal(periodNotices[0]?.details?.rangeKind, 'active');
      assert.equal(periodNotices[0]?.details?.rangeOrdinal, 0);
      const stored = snapshot.entities[0];
      assert.ok(stored);
      assert.equal(stored.entityJson, JSON.stringify(entity));
      const rangeRows = stored.currentMutations.filter(
        (mutation) =>
          mutation.operation === 'replace' &&
          mutation.table.tableName === 'alert_time_ranges',
      );
      assert.equal(rangeRows.length, applies ? 1 : 0);
      if (applies) {
        const range = rangeRows[0];
        assert.ok(range?.operation === 'replace');
        assert.equal(range.row.start_unix_seconds, '20');
        assert.equal(range.row.end_unix_seconds, 10);
        assert.equal(range.row.is_valid, 0);
      }
      assert.equal(inspections, 1);
    });
  }

  test('separates retained envelopes from safely applicable current mutations', () => {
    const fetched = createFetchedFeed('DIFFERENTIAL', [
      { alert: {} },
      { id: 'ambiguous', alert: {}, vehicle: {} },
      {
        id: 'ambiguous-tombstone',
        isDeleted: true,
        alert: {},
        vehicle: {},
      },
      { id: 'payload-free-tombstone', isDeleted: true },
      { id: 'current-alert', alert: {} },
    ] as unknown as FetchedRealtimeFeed['feed']['entity']);

    const {
      validation: { samples: notices },
      snapshot,
    } = createRealtimeSnapshotApplication(fetched, context);

    assert.equal(snapshot.applicationMode, 'differential');
    assert.equal(snapshot.feedType, 'mixed');
    assert.equal(snapshot.entities.length, 5);
    assert.equal(snapshot.entities[0]!.entityType, 'alert');
    assert.equal(snapshot.entities[0]!.currentMutations.length, 0);
    assert.equal(snapshot.entities[1]!.entityType, 'unknown');
    assert.equal(snapshot.entities[1]!.currentMutations.length, 0);
    assert.equal(snapshot.entities[2]!.currentMutations.length, 0);
    assert.equal(snapshot.entities[3]!.currentMutations.length, 9);
    assert.ok(
      snapshot.entities[3]!.currentMutations.every(
        ({ operation }) => operation === 'delete',
      ),
    );
    assert.ok(
      snapshot.entities[4]!.currentMutations.some(
        ({ operation }) => operation === 'replace',
      ),
    );
    assert.deepEqual(
      notices.map(({ code }) => code),
      [
        GtfsValidationNoticeCode.REALTIME_ENTITY_ID_MISSING,
        GtfsValidationNoticeCode.REALTIME_ENTITY_TYPE_AMBIGUOUS,
        GtfsValidationNoticeCode.REALTIME_TOMBSTONE_AMBIGUOUS,
      ],
    );
    assert.equal(snapshot.retentionExpiresAtUnixSeconds, 3_700);
    assert.equal(
      snapshot.payloadSha256,
      createHash('sha256').update(fetched.rawPayload).digest('hex'),
    );
  });

  test('retains a full-feed tombstone without creating delete mutations', () => {
    const {
      validation: { samples: notices },
      snapshot,
    } = createRealtimeSnapshotApplication(
      createFetchedFeed('FULL_DATASET', [
        { id: 'not-a-differential-delete', isDeleted: true, alert: {} },
      ]),
      context,
    );

    assert.equal(snapshot.applicationMode, 'full');
    assert.equal(snapshot.entities[0]!.currentMutations.length, 0);
    assert.deepEqual(
      notices.map(({ code }) => code),
      [GtfsValidationNoticeCode.REALTIME_TOMBSTONE_IN_FULL_DATASET],
    );
  });

  test('retains a declared type for an empty feed', () => {
    const {
      validation: { samples: notices },
      snapshot,
    } = createRealtimeSnapshotApplication(
      createFetchedFeed('FULL_DATASET', []),
      { ...context, declaredFeedType: 'tripUpdates' },
    );

    assert.equal(snapshot.feedType, 'tripUpdates');
    assert.deepEqual(notices, []);
  });

  test('reports a declared feed type mismatch as an error', () => {
    const {
      validation: { samples: notices },
      snapshot,
    } = createRealtimeSnapshotApplication(
      createFetchedFeed('FULL_DATASET', [
        { id: 'vehicle', vehicle: {} },
      ] as unknown as FetchedRealtimeFeed['feed']['entity']),
      { ...context, declaredFeedType: 'alerts' },
    );

    assert.equal(snapshot.feedType, 'alerts');
    assert.equal(notices[0]!.severity, 'error');
    assert.equal(
      notices[0]!.code,
      GtfsValidationNoticeCode.REALTIME_FEED_TYPE_MISMATCH,
    );
    assert.deepEqual(notices[0]!.details?.unexpectedFeedTypes, [
      'vehiclePositions',
    ]);
  });

  test('builds portable snapshot and envelope rows from one storage policy', () => {
    const { snapshot } = createRealtimeSnapshotApplication(
      createFetchedFeed('DIFFERENTIAL', [
        { id: 'deleted-alert', isDeleted: true, alert: {} },
      ]),
      context,
    );

    assert.deepEqual(createRealtimeSnapshotRow(snapshot), {
      source_id: 'source',
      realtime_feed_id: 'mixed',
      snapshot_id: snapshot.snapshotId,
      fetched_at_unix_seconds: 100,
      http_status: 200,
      http_headers: '{"etag":"test"}',
      content_type: 'application/x-protobuf',
      feed_header_version: '2.0',
      feed_header_incrementality: 'DIFFERENTIAL',
      feed_header_unix_seconds: 99,
      entity_count: 1,
      payload_sha256: snapshot.payloadSha256,
      raw_payload: snapshot.rawPayloadBase64,
      raw_payload_encoding: 'base64',
      retention_expires_at_unix_seconds: 3_700,
    });
    assert.deepEqual(
      createRealtimeFeedEntityRow(snapshot, snapshot.entities[0]!),
      {
        source_id: 'source',
        realtime_feed_id: 'mixed',
        snapshot_id: snapshot.snapshotId,
        entity_ordinal: 0,
        entity_id: 'deleted-alert',
        entity_type: 'alert',
        is_deleted: 1,
        entity_json: JSON.stringify({
          id: 'deleted-alert',
          isDeleted: true,
          alert: {},
        }),
        recorded_at_unix_seconds: 100,
        retention_expires_at_unix_seconds: 3_700,
      },
    );
    assert.deepEqual(GTFS_REALTIME_CURRENT_STATE_TABLES, [
      'alert_entity_selectors',
      'alert_time_ranges',
      'trip_update_stop_time_updates',
      'alerts',
      'realtime_shapes',
      'realtime_stops',
      'trip_modifications',
      'trip_updates',
      'vehicle_positions',
    ]);
  });
});
