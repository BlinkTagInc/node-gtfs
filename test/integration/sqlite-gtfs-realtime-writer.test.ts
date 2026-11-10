import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import { createSqliteGtfsRealtimeWriter } from '../../src/database/sqlite/realtime-writer.ts';
import { normalizeRealtimeEntity } from '../../src/realtime/normalizer.ts';
import type { RawRealtimeEntity } from '../../src/realtime/normalizer.ts';
import type {
  GtfsRealtimeWriter,
  RealtimeMutation,
} from '../../src/realtime/writer.ts';
import { createSqliteGtfsTables } from '../../src/database/sqlite/schema-writer.ts';
import { refreshGtfsRealtime } from '../../src/index.ts';
import { closeSqliteDatabase, openSqliteDatabase } from '../../src/sqlite.ts';

let snapshotOrdinal = 0;

async function applyCurrentEntities(
  writer: GtfsRealtimeWriter,
  entities: readonly (readonly RealtimeMutation[])[],
): Promise<void> {
  for (const mutations of entities) {
    const replacement = mutations.find(
      (mutation) => mutation.operation === 'replace',
    );
    assert.ok(replacement?.operation === 'replace');
    const sourceId = String(replacement.row.source_id);
    const realtimeFeedId = String(replacement.row.realtime_feed_id);
    const snapshotId = `test-${snapshotOrdinal++}`;
    const result = await writer.applySnapshot(
      {
        sourceId,
        realtimeFeedId,
        feedType: 'mixed',
        feedUrl: 'https://example.com/realtime.pb',
        snapshotId,
        fetchedAtUnixSeconds: snapshotOrdinal,
        httpStatus: 200,
        httpHeaders: null,
        contentType: 'application/x-protobuf',
        feedHeaderVersion: '2.0',
        feedHeaderIncrementality: 'DIFFERENTIAL',
        feedHeaderUnixSeconds: snapshotOrdinal,
        payloadSha256: snapshotId,
        rawPayloadBase64: '',
        retentionExpiresAtUnixSeconds: null,
        applicationMode: 'differential',
        entities: [
          {
            entityOrdinal: 0,
            entityId: String(replacement.row.entity_id ?? snapshotId),
            entityType: 'unknown',
            isDeleted: false,
            entityJson: '{}',
            currentMutations: mutations,
          },
        ],
      },
      null,
    );
    assert.deepEqual(result.errors, []);
  }
}

function createLegacyVehiclePositionsTable(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS vehicle_positions;
    CREATE TABLE vehicle_positions (
      id TEXT NOT NULL,
      bearing REAL,
      latitude REAL,
      longitude REAL,
      speed REAL,
      current_stop_sequence INTEGER,
      trip_id TEXT,
      trip_start_date TEXT,
      trip_start_time TEXT,
      congestion_level TEXT,
      occupancy_status TEXT,
      occupancy_percentage INTEGER,
      vehicle_stop_status TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      vehicle_wheelchair_accessible TEXT,
      timestamp TEXT,
      created_timestamp INTEGER NOT NULL,
      expiration_timestamp INTEGER NOT NULL,
      PRIMARY KEY (id)
    );
  `);
}

test('realtime replacement and child cleanup stay inside a source', async () => {
  const db = new Database(':memory:');
  const entity = (value: Record<string, unknown>) =>
    value as unknown as RawRealtimeEntity;
  const context = (sourceId: string) => ({
    sourceId,
    realtimeFeedId: 'test-feed',
    nowUnixSeconds: 1,
    expiresAtUnixSeconds: 61,
  });

  try {
    createSqliteGtfsTables({ database: db, extensions: ['gtfs-realtime'] });
    const writer = createSqliteGtfsRealtimeWriter(db);
    await applyCurrentEntities(writer, [
      normalizeRealtimeEntity({
        entityType: 'vehicle_position',
        entity: entity({ id: 'shared', vehicle: { vehicle: { label: 'A' } } }),
        context: context('a'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'vehicle_position',
        entity: entity({ id: 'shared', vehicle: { vehicle: { label: 'B' } } }),
        context: context('b'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'alert',
        entity: entity({
          id: 'shared-alert',
          alert: {
            headerText: { translation: [{ text: 'Alert' }] },
            descriptionText: { translation: [{ text: 'Description' }] },
            informedEntity: [{ stopId: 'a-stop' }],
          },
        }),
        context: context('a'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'alert',
        entity: entity({
          id: 'shared-alert',
          alert: {
            headerText: { translation: [{ text: 'Alert' }] },
            descriptionText: { translation: [{ text: 'Description' }] },
            informedEntity: [{ stopId: 'b-stop' }],
          },
        }),
        context: context('b'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'trip_update',
        entity: entity({
          id: 'Raw Trip/01',
          tripUpdate: {
            trip: { tripId: 'trip-1' },
            stopTimeUpdate: [
              { stopId: 'same-stop', stopSequence: 5 },
              { stopId: 'same-stop', stopSequence: 5 },
            ],
          },
        }),
        context: context('a'),
        alertPeriods: [],
      }),
    ]);

    assert.deepEqual(
      db
        .prepare(
          `SELECT trip_update_id, stop_time_update_ordinal, stop_id, stop_sequence
           FROM trip_update_stop_time_updates
           WHERE source_id = 'a'
           ORDER BY stop_time_update_ordinal`,
        )
        .all(),
      [
        {
          trip_update_id: 'Raw Trip/01',
          stop_time_update_ordinal: 0,
          stop_id: 'same-stop',
          stop_sequence: 5,
        },
        {
          trip_update_id: 'Raw Trip/01',
          stop_time_update_ordinal: 1,
          stop_id: 'same-stop',
          stop_sequence: 5,
        },
      ],
    );

    await applyCurrentEntities(writer, [
      normalizeRealtimeEntity({
        entityType: 'vehicle_position',
        entity: entity({ id: 'shared', vehicle: { vehicle: { label: 'A2' } } }),
        context: context('a'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'alert',
        entity: entity({
          id: 'shared-alert',
          alert: {
            headerText: { translation: [{ text: 'Alert' }] },
            descriptionText: { translation: [{ text: 'Description' }] },
            informedEntity: [{ stopId: 'a-stop-2' }, { stopId: 'a-stop-2' }],
          },
        }),
        context: context('a'),
        alertPeriods: [],
      }),
      normalizeRealtimeEntity({
        entityType: 'trip_update',
        entity: entity({
          id: 'Raw Trip/01',
          tripUpdate: { trip: { tripId: 'trip-1' }, stopTimeUpdate: [] },
        }),
        context: context('a'),
        alertPeriods: [],
      }),
    ]);

    assert.deepEqual(
      db
        .prepare(
          'SELECT source_id, entity_id, vehicle_label FROM vehicle_positions ORDER BY source_id',
        )
        .all(),
      [
        { source_id: 'a', entity_id: 'shared', vehicle_label: 'A2' },
        { source_id: 'b', entity_id: 'shared', vehicle_label: 'B' },
      ],
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT source_id, alert_id, selector_ordinal, stop_id
           FROM alert_entity_selectors
           ORDER BY source_id, selector_ordinal`,
        )
        .all(),
      [
        {
          source_id: 'a',
          alert_id: 'shared-alert',
          selector_ordinal: 0,
          stop_id: 'a-stop-2',
        },
        {
          source_id: 'a',
          alert_id: 'shared-alert',
          selector_ordinal: 1,
          stop_id: 'a-stop-2',
        },
        {
          source_id: 'b',
          alert_id: 'shared-alert',
          selector_ordinal: 0,
          stop_id: 'b-stop',
        },
      ],
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT source_id, realtime_feed_id, entity_id
           FROM trip_updates
           WHERE source_id = 'a'`,
        )
        .all(),
      [
        {
          source_id: 'a',
          realtime_feed_id: 'test-feed',
          entity_id: 'Raw Trip/01',
        },
      ],
    );
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) FROM trip_update_stop_time_updates
           WHERE source_id = 'a' AND trip_update_id = 'Raw Trip/01'`,
        )
        .pluck()
        .get(),
      0,
    );
  } finally {
    db.close();
  }
});

test('reused realtime bindings preserve nulls, zeroes, and Unicode text', async () => {
  const db = new Database(':memory:');
  try {
    createSqliteGtfsTables({ database: db, extensions: ['gtfs-realtime'] });
    const writer = createSqliteGtfsRealtimeWriter(db);
    const writeVehicle = async (vehicle: Record<string, unknown>) => {
      await applyCurrentEntities(writer, [
        normalizeRealtimeEntity({
          entityType: 'vehicle_position',
          entity: { id: 'shared', vehicle } as unknown as RawRealtimeEntity,
          context: {
            sourceId: 'source',
            realtimeFeedId: 'feed',
            nowUnixSeconds: 0,
            expiresAtUnixSeconds: 60,
          },
          alertPeriods: [],
        }),
      ]);
    };
    await writeVehicle({
      vehicle: { label: 'Straße' },
      position: { latitude: 1, longitude: 2, speed: 3 },
    });
    const read = db.prepare(`
      SELECT vehicle_label,
             latitude, longitude, speed, created_at_unix_seconds
      FROM vehicle_positions
    `);
    assert.deepEqual(read.get(), {
      vehicle_label: 'Straße',
      latitude: 1,
      longitude: 2,
      speed: 3,
      created_at_unix_seconds: 0,
    });
    await writeVehicle({ position: { latitude: 0, longitude: 0 } });
    assert.deepEqual(read.get(), {
      vehicle_label: null,
      latitude: 0,
      longitude: 0,
      speed: null,
      created_at_unix_seconds: 0,
    });
    await writeVehicle({ vehicle: { label: 'ÉCOLE' } });
    assert.deepEqual(read.get(), {
      vehicle_label: 'ÉCOLE',
      latitude: null,
      longitude: null,
      speed: null,
      created_at_unix_seconds: 0,
    });
    assert.equal(
      db.prepare('SELECT count(*) FROM realtime_feed_entities').pluck().get(),
      3,
    );
  } finally {
    db.close();
  }
});

test('refreshGtfsRealtime rejects a legacy realtime table without rewriting it', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-rt-migration-'));
  const databasePath = path.join(directory, 'gtfs.sqlite');
  const setupDb = new Database(databasePath);
  const originalFetch = globalThis.fetch;

  try {
    createSqliteGtfsTables({ database: setupDb });
    createLegacyVehiclePositionsTable(setupDb);
    setupDb.exec(`
      INSERT INTO vehicle_positions (
        id,
        vehicle_stop_status,
        created_timestamp,
        expiration_timestamp
      ) VALUES ('legacy', 'IN_TRANSIT_TO', 1, 2);
    `);
    const initialTableCount = setupDb
      .prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")
      .pluck()
      .get();
    setupDb.close();

    const message =
      GtfsRealtimeBindings.transit_realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'vehicle-position',
            vehicle: {
              trip: {
                routeId: 'route-1',
                directionId: 1,
              },
              stopId: 'stop-1',
              currentStatus: 'STOPPED_AT',
            },
          },
        ],
      });
    const payload = Buffer.from(
      GtfsRealtimeBindings.transit_realtime.FeedMessage.encode(
        message,
      ).finish(),
    );
    globalThis.fetch = (async () =>
      new Response(payload, { status: 200 })) as typeof fetch;

    const config = {
      database: { path: databasePath },
      sources: [
        {
          sourceId: 'vehicle-positions',
          realtime: {
            feeds: [
              {
                feedId: 'vehicles',
                url: 'https://example.test/vehicle-positions',
              },
            ],
          },
        },
      ],
      extensions: ['gtfs-realtime'] as const,
      reporting: { level: 'silent' as const },
    };

    await assert.rejects(
      refreshGtfsRealtime(config),
      (error: unknown) =>
        (error as { code?: string }).code === 'GTFS_SCHEMA_INVALID',
    );

    const db = openSqliteDatabase({ path: databasePath });
    assert.deepEqual(
      db
        .prepare(
          `SELECT id, vehicle_stop_status, created_timestamp, expiration_timestamp
           FROM vehicle_positions`,
        )
        .get(),
      {
        id: 'legacy',
        vehicle_stop_status: 'IN_TRANSIT_TO',
        created_timestamp: 1,
        expiration_timestamp: 2,
      },
    );
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) FROM sqlite_master
           WHERE type = 'table' AND name = 'vehicle_positions__node_gtfs_previous'`,
        )
        .pluck()
        .get(),
      0,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")
        .pluck()
        .get(),
      initialTableCount,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (setupDb.open) {
      setupDb.close();
    }
    const db = openSqliteDatabase({ path: databasePath });
    closeSqliteDatabase(db);
    await rm(directory, { recursive: true, force: true });
  }
});
