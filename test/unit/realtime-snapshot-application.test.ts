import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';
import { Kysely, SqliteDialect } from 'kysely';

import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import { refreshGtfsRealtime } from '../../src/operations.ts';
import { refreshGtfsRealtimeOnConnection } from '../../src/realtime/refresh.ts';
import { resolveGtfsInstanceConfig } from '../../src/config/resolver.ts';
import type { GtfsReportingConfig } from '../../src/reporting/types.ts';
import type {
  GtfsRealtimeFeedConfig,
  GtfsRealtimeRefreshOptions,
} from '../../src/types/config.ts';
import {
  closeSqliteDatabase,
  openSqliteDatabase,
} from '../../src/database/sqlite/connection.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type { RealtimeSnapshotApplication } from '../../src/realtime/writer.ts';
import { createSqliteGtfsRealtimeWriter } from '../../src/database/sqlite/realtime-writer.ts';
import { createSqliteGtfsTables } from '../../src/database/sqlite/schema-writer.ts';

function alertEntity(id: string, stopId: string, text: string) {
  return {
    id,
    alert: {
      headerText: { translation: [{ text }] },
      descriptionText: { translation: [{ text: `${text} description` }] },
      informedEntity: [{ stopId }],
    },
  };
}

function refreshWithTestDelay(
  database: Database.Database,
  options: Omit<GtfsRealtimeRefreshOptions, 'database'>,
  delays: number[],
) {
  const resolved = resolveGtfsInstanceConfig({
    ...options,
    database: { client: database },
  });
  return refreshGtfsRealtimeOnConnection({
    resolved: {
      ...resolved,
      sources: resolved.sources.map((source) => {
        assert.ok(source.realtime);
        return { ...source, realtime: source.realtime };
      }),
    },
    connection: { sqlite: database },
    databaseDescription: 'SQLite retry test',
    delay: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });
}

function refreshSingleRealtimeFeed(
  database: Database.Database,
  feed: GtfsRealtimeFeedConfig,
  reporting?: GtfsReportingConfig,
  delays: number[] = [],
) {
  return refreshWithTestDelay(
    database,
    {
      extensions: ['gtfs-realtime'],
      sources: [
        {
          sourceId: 'realtime-download-test',
          realtime: { feeds: [feed] },
        },
      ],
      ...(reporting === undefined ? {} : { reporting }),
    },
    delays,
  );
}

describe('transactional GTFS-Realtime snapshot application', () => {
  for (const adapter of ['native', 'kysely']) {
    test(`${adapter} rejects retention overflow without replacing existing data or history`, async (t) => {
      const sqlite = new Database(':memory:');
      const kysely = new Kysely({
        dialect: new SqliteDialect({ database: sqlite }),
      });
      t.after(() => kysely.destroy());
      let payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 1,
        entities: [alertEntity('alert', 'stop', 'Retained')],
      });
      t.mock.method(globalThis, 'fetch', async () => new Response(payload));
      const options = {
        database: {
          client: adapter === 'native' ? sqlite : kysely,
        },
        extensions: ['gtfs-realtime' as const],
        sources: [
          {
            realtime: {
              feeds: [
                {
                  type: 'alerts' as const,
                  url: 'https://example.test/feed.pb',
                },
              ],
            },
          },
        ],
      };
      await refreshGtfsRealtime({
        ...options,
        realtime: {
          retention: { currentEntitiesSeconds: 0, snapshotsSeconds: null },
        },
      });
      const retainedRows = () =>
        Object.fromEntries(
          [
            'alerts',
            'alert_entity_selectors',
            'realtime_feeds',
            'realtime_snapshots',
            'realtime_feed_entities',
          ].map((table) => [
            table,
            sqlite.prepare(`SELECT * FROM ${table}`).all(),
          ]),
        );
      const before = retainedRows();
      assert.deepEqual(
        sqlite
          .prepare(
            'SELECT retention_expires_at_unix_seconds FROM realtime_snapshots',
          )
          .all(),
        [{ retention_expires_at_unix_seconds: null }],
      );
      assert.deepEqual(
        sqlite
          .prepare(
            'SELECT expires_at_unix_seconds = created_at_unix_seconds AS expires_immediately FROM alerts',
          )
          .all(),
        [{ expires_immediately: 1 }],
      );
      payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 2,
        entities: [],
      });
      for (const setting of ['currentEntitiesSeconds', 'snapshotsSeconds']) {
        await assert.rejects(
          refreshGtfsRealtime({
            ...options,
            realtime: { retention: { [setting]: Number.MAX_SAFE_INTEGER } },
          }),
          (error) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
            assert.equal(error.details?.path, `realtime.retention.${setting}`);
            return true;
          },
        );
        assert.deepEqual(retainedRows(), before);
      }
    });
  }

  test('applies endpoint-local headers, retries, and multiple feed identities', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; authorization?: string }> = [];
    const signals: AbortSignal[] = [];
    const delays: number[] = [];
    let firstFeedAttempts = 0;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string>;
      assert.ok(init?.signal instanceof AbortSignal);
      signals.push(init.signal);
      calls.push({
        url,
        ...(headers.Authorization === undefined
          ? {}
          : { authorization: headers.Authorization }),
      });
      if (url.endsWith('/first.pb') && firstFeedAttempts++ === 0) {
        throw new Error('temporary transport failure');
      }
      const payload = url.endsWith('/first.pb')
        ? encodeRealtimeFeed({
            incrementality: 'FULL_DATASET',
            timestamp: 1,
            entities: [alertEntity('first-alert', 'first-stop', 'First')],
          })
        : encodeRealtimeFeed({
            incrementality: 'FULL_DATASET',
            timestamp: 1,
            entities: [
              {
                id: 'second-vehicle',
                vehicle: {
                  vehicle: { id: 'vehicle-1' },
                  position: { latitude: 1, longitude: 2 },
                  timestamp: 1_700_000_001,
                },
              },
            ],
          });
      return new Response(payload, { status: 200 });
    }) as typeof fetch;

    try {
      await refreshWithTestDelay(
        database,
        {
          extensions: ['gtfs-realtime'],
          sources: [
            {
              sourceId: 'endpoint-policy',
              realtime: {
                feeds: [
                  {
                    type: 'alerts',
                    url: 'https://example.test/first.pb',
                    requestHeaders: { Authorization: 'Bearer first' },
                    timeoutMs: 1_234,
                  },
                  {
                    type: 'vehiclePositions',
                    url: 'https://example.test/second.pb',
                    requestHeaders: { Authorization: 'Bearer second' },
                    timeoutMs: 2_345,
                  },
                ],
              },
            },
          ],
        },
        delays,
      );

      assert.deepEqual(delays, [1000]);

      assert.deepEqual(calls, [
        {
          url: 'https://example.test/first.pb',
          authorization: 'Bearer first',
        },
        {
          url: 'https://example.test/first.pb',
          authorization: 'Bearer first',
        },
        {
          url: 'https://example.test/second.pb',
          authorization: 'Bearer second',
        },
      ]);
      assert.equal(signals.length, 3);
      assert.ok(signals.every((signal) => !signal.aborted));
      assert.deepEqual(
        database
          .prepare(
            `SELECT realtime_feed_id, feed_type
             FROM realtime_feeds ORDER BY realtime_feed_id`,
          )
          .all(),
        [
          { realtime_feed_id: 'alerts', feed_type: 'alerts' },
          {
            realtime_feed_id: 'vehiclePositions',
            feed_type: 'vehiclePositions',
          },
        ],
      );
      assert.deepEqual(
        database
          .prepare(
            `SELECT timestamp, typeof(timestamp) AS storage_type
             FROM vehicle_positions`,
          )
          .get(),
        { timestamp: 1_700_000_001, storage_type: 'integer' },
      );
      assert.deepEqual(
        database
          .prepare(
            `SELECT feed_header_unix_seconds,
                    typeof(feed_header_unix_seconds) AS storage_type
             FROM realtime_snapshots
             WHERE realtime_feed_id = 'vehiclePositions'`,
          )
          .get(),
        { feed_header_unix_seconds: 1, storage_type: 'integer' },
      );
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('aborts timed-out requests and retries only through the configured attempt limit', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const signals: AbortSignal[] = [];
    const messages: string[] = [];
    const delays: number[] = [];

    globalThis.fetch = ((_input, init) => {
      assert.ok(init?.signal instanceof AbortSignal);
      const signal = init.signal;
      signals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        const watchdog = setTimeout(
          () => reject(new Error('Request signal did not abort')),
          1000,
        );
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(watchdog);
            reject(signal.reason);
          },
          {
            once: true,
          },
        );
      });
    }) as typeof fetch;

    try {
      await assert.rejects(
        refreshSingleRealtimeFeed(
          database,
          {
            type: 'alerts',
            url: 'https://example.test/timeout.pb',
            timeoutMs: 5,
          },
          {
            level: 'warn',
            reporter(event) {
              messages.push(event.message);
            },
          },
          delays,
        ),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.DOWNLOAD_FAILED);
          assert.match(error.message, /timed out after 5 ms/);
          assert.equal(error.details?.timeoutMs, 5);
          return true;
        },
      );
      assert.equal(signals.length, 3);
      assert.deepEqual(delays, [1000, 2000]);
      assert.ok(signals.every((signal) => signal.aborted));
      assert.equal(
        messages.filter((message) => message.includes('retrying')).length,
        2,
      );
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('retries retryable HTTP responses but not permanent client errors', async () => {
    const scenarios = [
      { status: 400, expectedAttempts: 1 },
      { status: 401, expectedAttempts: 1 },
      { status: 403, expectedAttempts: 1 },
      { status: 404, expectedAttempts: 1 },
      { status: 408, expectedAttempts: 3 },
      { status: 425, expectedAttempts: 3 },
      { status: 429, expectedAttempts: 3 },
      { status: 500, expectedAttempts: 3 },
      { status: 503, expectedAttempts: 3 },
    ] as const;
    const originalFetch = globalThis.fetch;

    try {
      for (const scenario of scenarios) {
        const database = new Database(':memory:');
        let attempts = 0;
        const messages: string[] = [];
        const delays: number[] = [];
        globalThis.fetch = (async () => {
          attempts += 1;
          return new Response(null, {
            status: scenario.status,
            statusText: 'Test response',
          });
        }) as typeof fetch;

        try {
          await assert.rejects(
            refreshSingleRealtimeFeed(
              database,
              {
                type: 'alerts',
                url: `https://example.test/status-${scenario.status}.pb`,
              },
              {
                level: 'warn',
                reporter(event) {
                  messages.push(event.message);
                },
              },
              delays,
            ),
            (error: unknown) => {
              assert.ok(isGtfsError(error));
              assert.equal(error.code, GtfsErrorCode.DOWNLOAD_HTTP_FAILED);
              assert.equal(error.statusCode, scenario.status);
              return true;
            },
          );
          assert.equal(attempts, scenario.expectedAttempts);
          assert.deepEqual(
            delays,
            scenario.expectedAttempts === 1 ? [] : [1000, 2000],
          );
          assert.equal(
            messages.filter((message) => message.includes('retrying')).length,
            scenario.expectedAttempts - 1,
          );
        } finally {
          database.close();
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects invalid protobuf without retrying', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
      return new Response(Buffer.from([0xff]), { status: 200 });
    }) as typeof fetch;

    try {
      await assert.rejects(
        refreshSingleRealtimeFeed(database, {
          type: 'alerts',
          url: 'https://example.test/invalid.pb',
        }),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.REALTIME_PROTOBUF_INVALID);
          assert.deepEqual(error.details, {
            realtimeFeedId: 'alerts',
            url: 'https://example.test/invalid.pb',
          });
          return true;
        },
      );
      assert.equal(attempts, 1);
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('redacts URL credentials, sensitive query values, and authorization from diagnostics', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const messages: string[] = [];
    const requestUrl =
      'https://feed-user:feed-password@example.test/alerts.pb?api_key=query-secret&route=red&access_token=token-secret#private';
    const authorization = 'Bearer authorization-secret';

    globalThis.fetch = (async (input, init) => {
      assert.equal(String(input), requestUrl);
      assert.ok(init?.headers);
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        authorization,
      );
      return new Response(null, { status: 401, statusText: 'Unauthorized' });
    }) as typeof fetch;

    try {
      let serializedDiagnostics = '';
      await assert.rejects(
        refreshSingleRealtimeFeed(
          database,
          {
            type: 'alerts',
            url: requestUrl,
            requestHeaders: { Authorization: authorization },
          },
          {
            reporter(event) {
              messages.push(event.message);
            },
          },
        ),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          serializedDiagnostics = JSON.stringify({
            details: error.details,
            message: error.message,
            reporterMessages: messages,
          });
          return true;
        },
      );

      assert.doesNotMatch(serializedDiagnostics, /feed-user|feed-password/);
      assert.doesNotMatch(serializedDiagnostics, /query-secret|token-secret/);
      assert.doesNotMatch(serializedDiagnostics, /authorization-secret/);
      assert.doesNotMatch(serializedDiagnostics, /#private/);
      assert.match(serializedDiagnostics, /api_key=\*\*\*/);
      assert.match(serializedDiagnostics, /access_token=\*\*\*/);
      assert.match(serializedDiagnostics, /route=red/);
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('persists alert images, alternative text, and all translations', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const localizedImage = [
      {
        url: 'https://example.test/map-en.png',
        mediaType: 'image/png',
        language: 'en',
      },
      {
        url: 'https://example.test/map-fr.webp',
        mediaType: 'image/webp',
        language: 'fr',
      },
    ];
    const alternativeText = [
      { text: 'Service change map', language: 'en' },
      { text: 'Carte du changement de service', language: 'fr' },
    ];
    const alert = alertEntity('alert-with-image', 'stop', 'Alert with image');
    const payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 1,
      entities: [
        {
          ...alert,
          alert: {
            ...alert.alert,
            image: { localizedImage },
            imageAlternativeText: { translation: alternativeText },
          },
        },
      ],
    });
    globalThis.fetch = (async () =>
      new Response(payload, { status: 200 })) as typeof fetch;

    try {
      await refreshSingleRealtimeFeed(database, {
        type: 'alerts',
        url: 'https://example.test/images.pb',
      });
      const row = database
        .prepare(
          `SELECT image,
                  image_alternative_text,
                  image_alternative_text_translations
           FROM alerts`,
        )
        .get() as {
        image: string;
        image_alternative_text: string;
        image_alternative_text_translations: string;
      };

      assert.deepEqual(JSON.parse(row.image), { localizedImage });
      assert.equal(row.image_alternative_text, 'Service change map');
      assert.deepEqual(
        JSON.parse(row.image_alternative_text_translations),
        alternativeText,
      );
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('rejects a declared feed type mismatch before writing a snapshot', async () => {
    const database = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    let payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 1,
      entities: [alertEntity('retained-alert', 'stop', 'Retained')],
    });
    globalThis.fetch = (async () =>
      new Response(payload, { status: 200 })) as typeof fetch;

    const update = () =>
      refreshGtfsRealtime({
        database: { client: database },
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'mismatch',
            realtime: {
              feeds: [
                {
                  type: 'alerts',
                  url: 'https://example.test/alerts.pb',
                },
              ],
            },
          },
        ],
        reporting: { level: 'silent' },
      });

    try {
      await update();
      payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 2,
        entities: [
          {
            id: 'unexpected-vehicle',
            vehicle: { position: { latitude: 1, longitude: 2 } },
          },
        ],
      });
      await assert.rejects(
        update(),
        (error: unknown) =>
          (error as { code?: unknown }).code ===
          GtfsErrorCode.REALTIME_FEED_TYPE_MISMATCH,
      );
      assert.equal(
        database
          .prepare('SELECT COUNT(*) FROM realtime_snapshots')
          .pluck()
          .get(),
        1,
      );
      assert.equal(
        database.prepare('SELECT COUNT(*) FROM realtime_feeds').pluck().get(),
        1,
      );
      assert.deepEqual(database.prepare('SELECT entity_id FROM alerts').all(), [
        { entity_id: 'retained-alert' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  test('uses the portable Kysely ingestion path', async () => {
    const sqlite = new Database(':memory:');
    const database = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const originalFetch = globalThis.fetch;
    const payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 1,
      entities: [alertEntity('portable-alert', 'portable-stop', 'Portable')],
    });
    globalThis.fetch = (async () =>
      new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/x-protobuf' },
      })) as typeof fetch;

    try {
      await refreshGtfsRealtime({
        database: { client: database },
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'portable',
            realtime: {
              feeds: [
                {
                  feedId: 'mixed',
                  url: 'https://example.test/realtime.pb',
                },
              ],
            },
          },
        ],
      });

      assert.deepEqual(
        sqlite
          .prepare(
            `SELECT source_id, realtime_feed_id, entity_id, header_text
             FROM alerts`,
          )
          .all(),
        [
          {
            source_id: 'portable',
            realtime_feed_id: 'mixed',
            entity_id: 'portable-alert',
            header_text: 'Portable',
          },
        ],
      );
      assert.equal(
        sqlite.prepare('SELECT COUNT(*) FROM realtime_snapshots').pluck().get(),
        1,
      );
    } finally {
      globalThis.fetch = originalFetch;
      await database.destroy();
    }
  });

  test('applies full, differential, tombstone, duplicate, and source-scoped semantics', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-rt-snapshot-'));
    const databasePath = path.join(directory, 'realtime.sqlite');
    const originalFetch = globalThis.fetch;
    let payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 1,
      entities: [
        alertEntity('Raw/A', 'stop-a', 'A1'),
        alertEntity('Raw/B', 'stop-b', 'B1'),
      ],
    });
    globalThis.fetch = (async () =>
      new Response(payload, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-protobuf',
          ETag: 'snapshot-etag',
        },
      })) as typeof fetch;

    const update = (sourceId: string) =>
      refreshGtfsRealtime({
        database: { path: databasePath },
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId,
            realtime: {
              feeds: [
                {
                  feedId: 'alerts',
                  url: 'https://example.test/alerts.pb',
                },
              ],
            },
          },
        ],
        realtime: {
          retention: {
            currentEntitiesSeconds: 60,
            snapshotsSeconds: 3600,
          },
        },
        reporting: { level: 'silent' },
      });

    let db: Database.Database | undefined;
    try {
      await update('target');
      await update('other');
      db = openSqliteDatabase({ path: databasePath });

      assert.deepEqual(
        db
          .prepare(
            `SELECT source_id, entity_id, header_text
             FROM alerts ORDER BY source_id, entity_id`,
          )
          .all(),
        [
          { source_id: 'other', entity_id: 'Raw/A', header_text: 'A1' },
          { source_id: 'other', entity_id: 'Raw/B', header_text: 'B1' },
          { source_id: 'target', entity_id: 'Raw/A', header_text: 'A1' },
          { source_id: 'target', entity_id: 'Raw/B', header_text: 'B1' },
        ],
      );
      const firstSnapshot = db
        .prepare(
          `SELECT raw_payload, raw_payload_encoding, http_status,
                  content_type, feed_header_incrementality, entity_count,
                  fetched_at_unix_seconds, retention_expires_at_unix_seconds
           FROM realtime_snapshots WHERE source_id = 'target'`,
        )
        .get() as Record<string, unknown>;
      const fetchedAtUnixSeconds = Number(
        firstSnapshot.fetched_at_unix_seconds,
      );
      assert.equal(
        firstSnapshot.retention_expires_at_unix_seconds,
        fetchedAtUnixSeconds + 3600,
      );
      assert.equal(
        db
          .prepare(
            `SELECT expires_at_unix_seconds FROM alerts
             WHERE source_id = 'target' AND entity_id = 'Raw/A'`,
          )
          .pluck()
          .get(),
        fetchedAtUnixSeconds + 60,
      );
      assert.deepEqual(
        {
          ...firstSnapshot,
          fetched_at_unix_seconds: undefined,
          retention_expires_at_unix_seconds: undefined,
        },
        {
          raw_payload: payload.toString('base64'),
          raw_payload_encoding: 'base64',
          http_status: 200,
          content_type: 'application/x-protobuf',
          feed_header_incrementality: 'FULL_DATASET',
          entity_count: 2,
          fetched_at_unix_seconds: undefined,
          retention_expires_at_unix_seconds: undefined,
        },
      );

      payload = encodeRealtimeFeed({
        incrementality: 'DIFFERENTIAL',
        timestamp: 2,
        entities: [alertEntity('Raw/A', 'stop-a-2', 'A2')],
      });
      await update('target');
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id, header_text FROM alerts
             WHERE source_id = 'target' ORDER BY entity_id`,
          )
          .all(),
        [
          { entity_id: 'Raw/A', header_text: 'A2' },
          { entity_id: 'Raw/B', header_text: 'B1' },
        ],
      );

      payload = encodeRealtimeFeed({
        incrementality: 'DIFFERENTIAL',
        timestamp: 3,
        entities: [{ id: 'Raw/A', isDeleted: true }],
      });
      await update('target');
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id FROM alerts
             WHERE source_id = 'target' ORDER BY entity_id`,
          )
          .pluck()
          .all(),
        ['Raw/B'],
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) FROM alert_entity_selectors
             WHERE source_id = 'target' AND alert_id = 'Raw/A'`,
          )
          .pluck()
          .get(),
        0,
      );
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id, is_deleted FROM realtime_feed_entities
             WHERE source_id = 'target' AND entity_id = 'Raw/A'
             ORDER BY recorded_at_unix_seconds`,
          )
          .all(),
        [
          { entity_id: 'Raw/A', is_deleted: 0 },
          { entity_id: 'Raw/A', is_deleted: 0 },
          { entity_id: 'Raw/A', is_deleted: 1 },
        ],
      );

      await update('target');
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) FROM realtime_snapshots
             WHERE source_id = 'target'`,
          )
          .pluck()
          .get(),
        3,
      );

      payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 4,
        entities: [alertEntity('Raw/C', 'stop-c', 'C1')],
      });
      await update('target');
      assert.deepEqual(
        db
          .prepare(
            `SELECT source_id, entity_id FROM alerts
             ORDER BY source_id, entity_id`,
          )
          .all(),
        [
          { source_id: 'other', entity_id: 'Raw/A' },
          { source_id: 'other', entity_id: 'Raw/B' },
          { source_id: 'target', entity_id: 'Raw/C' },
        ],
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) FROM realtime_snapshots
             WHERE source_id = 'target'`,
          )
          .pluck()
          .get(),
        4,
      );

      payload = encodeRealtimeFeed({
        incrementality: 'DIFFERENTIAL',
        timestamp: 5,
        entities: [
          alertEntity('mixed-alert', 'mixed-stop', 'Mixed'),
          {
            id: 'mixed-vehicle',
            vehicle: { position: { latitude: 1, longitude: 2 } },
          },
          { id: 'ambiguous-tombstone', isDeleted: true },
        ],
      });
      const report = await update('mixed');
      assert.ok(report);
      assert.equal(
        report.validation.samples.some(
          (notice) =>
            notice.code ===
            GtfsValidationNoticeCode.REALTIME_TOMBSTONE_AMBIGUOUS,
        ),
        false,
      );
      assert.equal(
        db
          .prepare(
            `SELECT feed_type FROM realtime_feeds
             WHERE source_id = 'mixed' AND realtime_feed_id = 'alerts'`,
          )
          .pluck()
          .get(),
        'mixed',
      );

      payload = encodeRealtimeFeed({
        incrementality: 'FULL_DATASET',
        timestamp: 6,
        entities: [
          {
            id: 'dynamic-shape',
            shape: { shapeId: 'detour-shape', encodedPolyline: 'encoded' },
          },
          {
            id: 'dynamic-stop',
            stop: {
              stopId: 'temporary-platform',
              stopName: { translation: [{ text: 'Temporary Platform' }] },
              stopLat: 37.1,
              stopLon: -122.1,
              wheelchairBoarding: 'AVAILABLE',
            },
          },
          {
            id: 'detour',
            tripModifications: {
              selectedTrips: [{ tripIds: ['trip-1'], shapeId: 'shape-1' }],
              serviceDates: ['20260828'],
              modifications: [
                {
                  replacementStops: [
                    { stopId: 'temporary-platform', travelTimeToStop: 120 },
                  ],
                  serviceAlertId: 'alert-1',
                },
              ],
            },
          },
        ],
      });
      await update('modern');
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id, shape_id, encoded_polyline FROM realtime_shapes
             WHERE source_id = 'modern'`,
          )
          .all(),
        [
          {
            entity_id: 'dynamic-shape',
            shape_id: 'detour-shape',
            encoded_polyline: 'encoded',
          },
        ],
      );
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id, stop_id, stop_name, wheelchair_boarding
             FROM realtime_stops WHERE source_id = 'modern'`,
          )
          .all(),
        [
          {
            entity_id: 'dynamic-stop',
            stop_id: 'temporary-platform',
            stop_name: 'Temporary Platform',
            wheelchair_boarding: 'AVAILABLE',
          },
        ],
      );
      assert.deepEqual(
        JSON.parse(
          db
            .prepare(
              `SELECT service_dates FROM trip_modifications
               WHERE source_id = 'modern'`,
            )
            .pluck()
            .get() as string,
        ),
        ['20260828'],
      );
      assert.deepEqual(
        db
          .prepare(
            `SELECT entity_id, entity_type FROM realtime_feed_entities
             WHERE source_id = 'modern' ORDER BY entity_ordinal`,
          )
          .all(),
        [
          { entity_id: 'dynamic-shape', entity_type: 'shape' },
          { entity_id: 'dynamic-stop', entity_type: 'stop' },
          { entity_id: 'detour', entity_type: 'trip_modifications' },
        ],
      );

      payload = encodeRealtimeFeed({
        incrementality: 2,
        timestamp: 7,
        entities: [
          alertEntity('unsupported-alert', 'unsupported-stop', 'Unsupported'),
        ],
      });
      const unsupportedReport = await update('unsupported');
      assert.ok(unsupportedReport);
      assert.equal(
        unsupportedReport.validation.samples.some(
          (notice) =>
            notice.code ===
            GtfsValidationNoticeCode.REALTIME_INCREMENTALITY_UNSUPPORTED,
        ),
        true,
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) FROM realtime_snapshots
             WHERE source_id = 'unsupported'`,
          )
          .pluck()
          .get(),
        1,
      );
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) FROM alerts
             WHERE source_id = 'unsupported'`,
          )
          .pluck()
          .get(),
        0,
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (db?.open) {
        closeSqliteDatabase(db);
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('rolls history, full-feed clearing, and current writes back together', async () => {
    const db = new Database(':memory:');
    try {
      createSqliteGtfsTables({
        database: db,
        mode: 'recreate',
        extensions: ['gtfs-realtime'],
      });
      const writer = createSqliteGtfsRealtimeWriter(db);
      const snapshot = (
        snapshotId: string,
        entityId: string,
        valid: boolean,
      ): RealtimeSnapshotApplication => ({
        sourceId: 'atomic',
        realtimeFeedId: 'alerts',
        feedType: 'alerts',
        feedUrl: 'https://example.test/alerts.pb',
        snapshotId,
        fetchedAtUnixSeconds: snapshotId === 'first' ? 1 : 2,
        httpStatus: 200,
        httpHeaders: '{}',
        contentType: 'application/x-protobuf',
        feedHeaderVersion: '2.0',
        feedHeaderIncrementality: 'FULL_DATASET',
        feedHeaderUnixSeconds: null,
        payloadSha256: snapshotId.padEnd(64, '0'),
        rawPayloadBase64: Buffer.from(snapshotId).toString('base64'),
        retentionExpiresAtUnixSeconds: null,
        applicationMode: 'full',
        entities: [
          {
            entityOrdinal: 0,
            entityId,
            entityType: 'alert',
            isDeleted: false,
            entityJson: JSON.stringify({ id: entityId, alert: {} }),
            currentMutations: [
              {
                operation: 'replace',
                table: compiledTableRegistry.alerts,
                row: {
                  source_id: 'atomic',
                  realtime_feed_id: 'alerts',
                  ...(valid ? { entity_id: entityId } : {}),
                  header_text: entityId,
                  description_text: `${entityId} description`,
                  created_at_unix_seconds: 1,
                  expires_at_unix_seconds: 100,
                },
              },
            ],
          },
        ],
      });

      assert.deepEqual(
        await writer.applySnapshot(snapshot('first', 'kept', true), null),
        {
          recordCount: 1,
          errors: [],
          duplicateSnapshot: false,
        },
      );
      const failed = await writer.applySnapshot(
        snapshot('failed', 'bad', false),
        null,
      );
      assert.equal(failed instanceof Promise, false);
      assert.equal(
        (failed as { readonly errors: readonly unknown[] }).errors.length,
        1,
      );
      assert.deepEqual(
        db.prepare('SELECT snapshot_id FROM realtime_snapshots').pluck().all(),
        ['first'],
      );
      assert.deepEqual(
        db
          .prepare('SELECT entity_id FROM realtime_feed_entities')
          .pluck()
          .all(),
        ['kept'],
      );
      assert.deepEqual(
        db.prepare('SELECT entity_id FROM alerts').pluck().all(),
        ['kept'],
      );

      assert.deepEqual(
        await writer.applySnapshot(snapshot('first', 'kept', true), null),
        {
          recordCount: 0,
          errors: [],
          duplicateSnapshot: true,
        },
      );
      assert.deepEqual(
        db.prepare('SELECT entity_id FROM alerts').pluck().all(),
        ['kept'],
      );
    } finally {
      db.close();
    }
  });
});
