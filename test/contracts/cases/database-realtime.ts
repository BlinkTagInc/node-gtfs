import assert from 'node:assert/strict';
import { recreateTestSchema } from '../../helpers/recreate-schema.ts';
import { encodeRealtimeFeed } from '../../helpers/realtime-feed.ts';
import { Kysely, sql } from 'kysely';
import {
  Gtfs,
  GtfsErrorCode,
  importGtfs,
  refreshGtfsRealtime,
} from '../../../src/index.ts';
import { type GtfsDatabaseDialect } from '../../../src/kysely.ts';
import { gtfsManifest } from '../../../src/schema/index.ts';
import { completeFixturePath } from '../../helpers/test-utils.ts';
import type { ConformanceDatabase } from './database-types.ts';

function realtimeAlert(
  entityId: string,
  stopId: string,
  headerText: string,
): Record<string, unknown> {
  return {
    id: entityId,
    alert: {
      headerText: { translation: [{ text: headerText }] },
      descriptionText: {
        translation: [{ text: `${headerText} description` }],
      },
      informedEntity: [{ stopId }],
    },
  };
}
export async function verifyPortableRealtimeIngestion(
  db: Kysely<ConformanceDatabase>,
  dialect: 'postgres' | 'mysql',
): Promise<void> {
  await recreateTestSchema({
    database: { client: db },
    extensions: ['gtfs-realtime'],
  });
  await importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'schedule-sentinel',
        schedule: { path: completeFixturePath },
      },
    ],
    reporting: { level: 'silent' },
  });
  const schedule = await db.selectFrom('agency').selectAll().execute();
  assert.ok(schedule.length > 0);
  const sourceId = `realtime-${dialect}`;
  const feedId = 'portable-alerts';
  const feedUrl = `https://example.test/${dialect}/alerts.pb`;
  const originalFetch = globalThis.fetch;
  let payload = encodeRealtimeFeed({
    incrementality: 'FULL_DATASET',
    timestamp: 1,
    entities: [
      realtimeAlert('alert-a', 'stop-a', 'A1'),
      realtimeAlert('alert-b', 'stop-b', 'B1'),
    ],
  });
  globalThis.fetch = (async (input) => {
    assert.equal(String(input), feedUrl);
    return new Response(payload, {
      status: 200,
      headers: { 'Content-Type': 'application/x-protobuf' },
    });
  }) as typeof fetch;
  const update = () =>
    refreshGtfsRealtime({
      database: { client: db },
      extensions: ['gtfs-realtime'],
      sources: [
        {
          sourceId,
          realtime: {
            feeds: [{ feedId, type: 'alerts', url: feedUrl }],
          },
        },
      ],
      reporting: { level: 'silent' },
    });
  try {
    await update();
    assert.deepEqual(
      (
        await sql<{
          entity_id: string;
          header_text: string;
        }>`
          select entity_id, header_text
          from alerts
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by entity_id
        `.execute(db)
      ).rows,
      [
        { entity_id: 'alert-a', header_text: 'A1' },
        { entity_id: 'alert-b', header_text: 'B1' },
      ],
    );
    assert.deepEqual(
      (
        await sql<{
          alert_id: string;
          stop_id: string;
        }>`
          select alert_id, stop_id
          from alert_entity_selectors
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by alert_id
        `.execute(db)
      ).rows,
      [
        { alert_id: 'alert-a', stop_id: 'stop-a' },
        { alert_id: 'alert-b', stop_id: 'stop-b' },
      ],
    );
    payload = encodeRealtimeFeed({
      incrementality: 'DIFFERENTIAL',
      timestamp: 2,
      entities: [realtimeAlert('alert-a', 'stop-a-2', 'A2')],
    });
    await update();
    assert.deepEqual(
      (
        await sql<{
          entity_id: string;
          header_text: string;
        }>`
          select entity_id, header_text
          from alerts
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by entity_id
        `.execute(db)
      ).rows,
      [
        { entity_id: 'alert-a', header_text: 'A2' },
        { entity_id: 'alert-b', header_text: 'B1' },
      ],
    );
    assert.deepEqual(
      (
        await sql<{
          stop_id: string;
        }>`
          select stop_id
          from alert_entity_selectors
          where source_id = ${sourceId}
            and realtime_feed_id = ${feedId}
            and alert_id = 'alert-a'
        `.execute(db)
      ).rows,
      [{ stop_id: 'stop-a-2' }],
    );
    payload = encodeRealtimeFeed({
      incrementality: 'DIFFERENTIAL',
      timestamp: 3,
      entities: [{ id: 'alert-a', isDeleted: true }],
    });
    await update();
    assert.deepEqual(
      (
        await sql<{
          entity_id: string;
        }>`
          select entity_id
          from alerts
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by entity_id
        `.execute(db)
      ).rows,
      [{ entity_id: 'alert-b' }],
    );
    const selectorCount = await sql<{
      count: string | number;
    }>`
      select count(*) as count
      from alert_entity_selectors
      where source_id = ${sourceId}
        and realtime_feed_id = ${feedId}
        and alert_id = 'alert-a'
    `.execute(db);
    assert.deepEqual(Number(selectorCount.rows.at(0)?.count), 0);
    payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 4,
      entities: [realtimeAlert('alert-c', 'stop-c', 'C1')],
    });
    await update();
    assert.deepEqual(
      (
        await sql<{
          entity_id: string;
          header_text: string;
        }>`
          select entity_id, header_text
          from alerts
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by entity_id
        `.execute(db)
      ).rows,
      [{ entity_id: 'alert-c', header_text: 'C1' }],
    );
    assert.deepEqual(
      (
        await sql<{
          alert_id: string;
          stop_id: string;
        }>`
          select alert_id, stop_id
          from alert_entity_selectors
          where source_id = ${sourceId} and realtime_feed_id = ${feedId}
          order by alert_id
        `.execute(db)
      ).rows,
      [{ alert_id: 'alert-c', stop_id: 'stop-c' }],
    );
    const snapshots = await sql<{
      feed_header_incrementality: string;
      feed_header_unix_seconds: number;
      entity_count: number;
    }>`
      select feed_header_incrementality,
             feed_header_unix_seconds,
             entity_count
      from realtime_snapshots
      where source_id = ${sourceId} and realtime_feed_id = ${feedId}
      order by feed_header_unix_seconds
    `.execute(db);
    assert.deepEqual(
      snapshots.rows.map(
        ({
          feed_header_incrementality,
          feed_header_unix_seconds,
          entity_count,
        }) => ({
          feed_header_incrementality,
          feed_header_unix_seconds: Number(feed_header_unix_seconds),
          entity_count: Number(entity_count),
        }),
      ),
      [
        {
          feed_header_incrementality: 'FULL_DATASET',
          feed_header_unix_seconds: 1,
          entity_count: 2,
        },
        {
          feed_header_incrementality: 'DIFFERENTIAL',
          feed_header_unix_seconds: 2,
          entity_count: 1,
        },
        {
          feed_header_incrementality: 'DIFFERENTIAL',
          feed_header_unix_seconds: 3,
          entity_count: 1,
        },
        {
          feed_header_incrementality: 'FULL_DATASET',
          feed_header_unix_seconds: 4,
          entity_count: 1,
        },
      ],
    );
    const envelopeCounts = await sql<{
      is_deleted: number;
      count: string | number;
    }>`
      select is_deleted, count(*) as count
      from realtime_feed_entities
      where source_id = ${sourceId}
        and realtime_feed_id = ${feedId}
        and entity_id = 'alert-a'
      group by is_deleted
      order by is_deleted
    `.execute(db);
    assert.deepEqual(
      envelopeCounts.rows.map(({ is_deleted, count }) => ({
        is_deleted: Number(is_deleted),
        count: Number(count),
      })),
      [
        { is_deleted: 0, count: 2 },
        { is_deleted: 1, count: 1 },
      ],
    );
    assert.deepEqual(
      await db.selectFrom('agency').selectAll().execute(),
      schedule,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  await verifyRealtimeFidelityAndRollback(db, dialect);
}
export async function verifyRealtimeFidelityAndRollback(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const localizedImage = [
    {
      url: 'https://example.test/map.png',
      mediaType: 'image/png',
      language: 'en',
    },
  ];
  const translations = [
    { text: 'Service map', language: 'en' },
    { text: 'Carte', language: 'fr' },
  ];
  const alert = realtimeAlert('alert', 'stop', 'Alert');
  let payload = encodeRealtimeFeed({
    incrementality: 'FULL_DATASET',
    timestamp: 10,
    entities: [
      {
        ...alert,
        alert: {
          ...(alert.alert as object),
          communicationPeriod: [{ start: 10, end: 20 }],
          impactPeriod: [{ start: 15, end: 25 }],
          image: { localizedImage },
          imageAlternativeText: { translation: translations },
        },
      },
      {
        id: 'trip',
        tripUpdate: {
          trip: { tripId: 'scheduled-trip', routeId: 'route' },
          stopTimeUpdate: [
            {
              stopSequence: 1,
              stopId: 'stop',
              arrival: {
                delay: 60,
                time: 1700000000,
                scheduledTime: 1699999940,
              },
              departure: { time: 1700000030, scheduledTime: 1699999970 },
            },
          ],
        },
      },
      {
        id: 'vehicle',
        vehicle: {
          trip: { tripId: 'scheduled-trip' },
          vehicle: { id: 'bus', label: 'Bus' },
          position: { latitude: 37.5, longitude: -122.5 },
          timestamp: 1700000000,
        },
      },
    ],
  });
  const originalPayload = Buffer.from(payload);
  const gtfs = new Gtfs({
    database: { client: db },
    extensions: ['gtfs-realtime'],
    sources: [
      {
        sourceId: 'fidelity',
        realtime: {
          feeds: [{ type: 'mixed', url: 'https://example.test/mixed.pb' }],
        },
      },
    ],
    reporting: { level: 'silent' },
  });
  globalThis.fetch = async () => new Response(payload);
  const guard = 'realtime_fidelity_guard';
  let guardCreated = false;
  const snapshotRows = async () => {
    const result: Record<string, unknown> = {};
    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      if (table.specification === 'gtfs-realtime') {
        result[tableName] = (
          await sql`select * from ${sql.table(tableName)}`.execute(db)
        ).rows
          .map((row) =>
            JSON.stringify(row, (_key, value: unknown) =>
              typeof value === 'bigint' ? String(value) : value,
            ),
          )
          .sort();
      }
    }
    return result;
  };
  try {
    await gtfs.schema.recreate();
    assert.equal((await gtfs.realtime.refresh()).success, true);
    assert.deepEqual(
      await gtfs.realtime.persistence.feeds.select('feed_type').all(),
      [{ feed_type: 'mixed' }],
    );
    assert.deepEqual(
      await gtfs.realtime.tripUpdateStopTimeUpdates
        .select(
          'arrival_unix_seconds',
          'arrival_scheduled_unix_seconds',
          'departure_unix_seconds',
          'departure_scheduled_unix_seconds',
        )
        .all(),
      [
        {
          arrival_unix_seconds: 1700000000,
          arrival_scheduled_unix_seconds: 1699999940,
          departure_unix_seconds: 1700000030,
          departure_scheduled_unix_seconds: 1699999970,
        },
      ],
    );
    assert.deepEqual(
      await gtfs.realtime.tripUpdates
        .select('entity_id', 'trip_id', 'route_id')
        .all(),
      [{ entity_id: 'trip', trip_id: 'scheduled-trip', route_id: 'route' }],
    );
    const children = (
      await sql<{
        trip_update_id: string;
        arrival_delay: number;
        stop_sequence: number;
      }>`
      select trip_update_id, arrival_delay, stop_sequence from trip_update_stop_time_updates`.execute(
        db,
      )
    ).rows;
    assert.deepEqual(
      children.map((row) => ({
        ...row,
        arrival_delay: Number(row.arrival_delay),
        stop_sequence: Number(row.stop_sequence),
      })),
      [{ trip_update_id: 'trip', arrival_delay: 60, stop_sequence: 1 }],
    );
    assert.deepEqual(
      await gtfs.realtime.vehiclePositions
        .select(
          'entity_id',
          'vehicle_id',
          'vehicle_label',
          'latitude',
          'longitude',
        )
        .all(),
      [
        {
          entity_id: 'vehicle',
          vehicle_id: 'bus',
          vehicle_label: 'Bus',
          latitude: 37.5,
          longitude: -122.5,
        },
      ],
    );
    const images = await gtfs.realtime.alerts
      .select(
        'image',
        'image_alternative_text',
        'image_alternative_text_translations',
      )
      .first();
    assert.ok(images);
    assert.deepEqual(JSON.parse(String(images.image)), { localizedImage });
    assert.equal(images.image_alternative_text, 'Service map');
    assert.deepEqual(
      JSON.parse(String(images.image_alternative_text_translations)),
      translations,
    );
    const ranges = (
      await sql<{
        range_kind: string;
        start_unix_seconds: number;
        end_unix_seconds: number;
      }>`
      select range_kind, start_unix_seconds, end_unix_seconds from alert_time_ranges order by range_kind`.execute(
        db,
      )
    ).rows;
    assert.deepEqual(
      ranges.map((row) => ({
        ...row,
        start_unix_seconds: Number(row.start_unix_seconds),
        end_unix_seconds: Number(row.end_unix_seconds),
      })),
      [
        {
          range_kind: 'communication',
          start_unix_seconds: 10,
          end_unix_seconds: 20,
        },
        { range_kind: 'impact', start_unix_seconds: 15, end_unix_seconds: 25 },
      ],
    );
    const raw = (
      await sql<{
        raw_payload: string;
        raw_payload_encoding: string;
      }>`select raw_payload, raw_payload_encoding from realtime_snapshots`.execute(
        db,
      )
    ).rows[0];
    assert.ok(raw);
    assert.equal(raw.raw_payload_encoding, 'base64');
    assert.deepEqual(Buffer.from(raw.raw_payload, 'base64'), originalPayload);
    for (const field of ['communicationActiveAt', 'impactActiveAt'] as const) {
      assert.deepEqual(
        await gtfs.realtime.alerts
          .where({ [field]: 9223372036854775807n })
          .all(),
        [],
      );
      await assert.rejects(
        async () =>
          gtfs.realtime.alerts.where({ [field]: 9223372036854775808n }).all(),
        { code: GtfsErrorCode.QUERY_INVALID },
      );
    }
    await sql
      .raw(
        dialect === 'sqlite'
          ? `create trigger ${guard} before insert on alert_entity_selectors when NEW.stop_id = 'fail' begin select raise(ABORT, 'injected realtime failure'); end`
          : `alter table alert_entity_selectors add constraint ${guard} check (stop_id <> 'fail')`,
      )
      .execute(db);
    guardCreated = true;
    const before = await snapshotRows();
    payload = encodeRealtimeFeed({
      incrementality: 'FULL_DATASET',
      timestamp: 11,
      entities: [realtimeAlert('replacement', 'fail', 'Must roll back')],
    });
    await assert.rejects(async () => gtfs.realtime.refresh(), {
      code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
    });
    assert.deepEqual(
      await snapshotRows(),
      before,
      'History, envelopes, feed metadata, parent clearing, and child writes must roll back together',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (guardCreated) {
      await sql
        .raw(
          dialect === 'sqlite'
            ? `drop trigger ${guard}`
            : `alter table alert_entity_selectors drop constraint ${guard}`,
        )
        .execute(db);
    }
    await gtfs.close();
  }
}
