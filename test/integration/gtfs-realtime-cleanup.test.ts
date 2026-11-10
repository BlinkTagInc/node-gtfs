import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';

import { Gtfs, GtfsErrorCode } from '../../src/index.ts';
import { cleanupGtfsRealtime } from '../../src/kysely.ts';

async function seedExpirationRows(gtfs: Gtfs): Promise<void> {
  await gtfs.database.withKysely({
    callback: async (database) => {
      await sql`insert into alerts
        (source_id, realtime_feed_id, entity_id, header_text, description_text,
         created_at_unix_seconds, expires_at_unix_seconds)
        values
          ('alpha', 'alerts', 'expired-alert', 'Expired', 'Expired', 1, 100),
          ('alpha', 'alerts', 'live-alert', 'Live', 'Live', 1, 101),
          ('beta', 'alerts', 'expired-alert', 'Expired', 'Expired', 1, 100)`.execute(
        database,
      );
      await sql`insert into alert_entity_selectors
        (source_id, realtime_feed_id, alert_id, selector_ordinal,
         created_at_unix_seconds, expires_at_unix_seconds)
        values
          ('alpha', 'alerts', 'expired-alert', 0, 1, 100),
          ('alpha', 'alerts', 'missing-alert', 0, 1, 999),
          ('beta', 'alerts', 'expired-alert', 0, 1, 100)`.execute(database);
      await sql`insert into alert_time_ranges
        (source_id, realtime_feed_id, alert_id, range_kind, range_ordinal,
         start_unix_seconds, end_unix_seconds, is_valid, created_at_unix_seconds,
         expires_at_unix_seconds)
        values
          ('alpha', 'alerts', 'expired-alert', 'communication', 0,
           1, 2, 1, 1, 999),
          ('beta', 'alerts', 'expired-alert', 'communication', 0,
           1, 2, 1, 1, 100)`.execute(database);
      await sql`insert into trip_updates
        (source_id, realtime_feed_id, entity_id, created_at_unix_seconds, expires_at_unix_seconds)
        values ('alpha', 'trip_updates', 'expired-trip', 1, 100)`.execute(
        database,
      );
      await sql`insert into trip_update_stop_time_updates
        (source_id, realtime_feed_id, trip_update_id,
         stop_time_update_ordinal, created_at_unix_seconds, expires_at_unix_seconds)
        values ('alpha', 'trip_updates', 'expired-trip', 0, 1, 100)`.execute(
        database,
      );
      await sql`insert into vehicle_positions
        (source_id, realtime_feed_id, entity_id, created_at_unix_seconds, expires_at_unix_seconds)
        values
          ('alpha', 'vehicle_positions', 'expired-vehicle', 1, 100),
          ('alpha', 'vehicle_positions', 'live-vehicle', 1, 101)`.execute(
        database,
      );
      await sql`insert into realtime_snapshots
        (source_id, realtime_feed_id, snapshot_id, fetched_at_unix_seconds,
         entity_count, payload_sha256, raw_payload, raw_payload_encoding,
         retention_expires_at_unix_seconds)
        values
          ('alpha', 'alerts', 'expired-snapshot', 1, 1, 'expired-hash',
           'ZXhwaXJlZA==', 'base64', 100),
          ('alpha', 'alerts', 'live-snapshot', 2, 1, 'live-hash',
           'bGl2ZQ==', 'base64', null),
          ('beta', 'alerts', 'expired-snapshot', 1, 1, 'beta-hash',
           'YmV0YQ==', 'base64', 100)`.execute(database);
      await sql`insert into realtime_feed_entities
        (source_id, realtime_feed_id, snapshot_id, entity_ordinal, entity_type,
         is_deleted, entity_json, recorded_at_unix_seconds,
         retention_expires_at_unix_seconds)
        values
          ('alpha', 'alerts', 'expired-snapshot', 0, 'alert', 0, '{}', 1, null),
          ('alpha', 'alerts', 'live-snapshot', 0, 'alert', 0, '{}', 2, 100),
          ('alpha', 'alerts', 'missing-snapshot', 0, 'alert', 0, '{}', 2, 999),
          ('beta', 'alerts', 'expired-snapshot', 0, 'alert', 0, '{}', 1, 100)`.execute(
        database,
      );
    },
  });
}

describe('portable GTFS-Realtime expiration cleanup', () => {
  test('rejects unknown and malformed cleanup options before querying', async () => {
    const sqlite = new Database(':memory:');
    let queryCount = 0;
    const database = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
      log() {
        queryCount += 1;
      },
    });
    const gtfs = new Gtfs({
      database: { client: database },
      extensions: ['gtfs-realtime'],
      reporting: { level: 'silent' },
    });
    const standaloneInvalidCalls = [
      () =>
        cleanupGtfsRealtime({
          database,
          extensions: ['gtfs-realtime'],
          unexpected: true,
        } as never),
      () =>
        cleanupGtfsRealtime({
          database,
          extensions: ['gtfs-realtime'],
          currentState: 'yes',
        } as never),
      () =>
        cleanupGtfsRealtime({
          database,
          extensions: ['gtfs-realtime'],
          snapshotHistory: 1,
        } as never),
      () =>
        cleanupGtfsRealtime({
          database,
          extensions: ['gtfs-realtime'],
          sourceIds: 'alpha',
        } as never),
      () =>
        cleanupGtfsRealtime({
          database,
          extensions: ['gtfs-realtime'],
          reporting: 'silent',
        } as never),
      () => cleanupGtfsRealtime(null as never),
      () => cleanupGtfsRealtime([] as never),
    ];
    const instanceInvalidCalls = [
      () => gtfs.realtime.cleanup({ database } as never),
      () => gtfs.realtime.cleanup({ extensions: ['gtfs-realtime'] } as never),
      () => gtfs.realtime.cleanup({ sourceIds: ['alpha'] } as never),
      () => gtfs.realtime.cleanup({ reporting: { level: 'info' } } as never),
      () => gtfs.realtime.cleanup({ currentState: 'yes' } as never),
    ];

    try {
      for (const call of [...standaloneInvalidCalls, ...instanceInvalidCalls]) {
        await assert.rejects(
          call(),
          (error: unknown) =>
            (error as { code?: unknown }).code === GtfsErrorCode.CONFIG_INVALID,
        );
      }
      assert.equal(queryCount, 0);
    } finally {
      await gtfs.close();
      await database.destroy();
    }
  });

  test('is source-scoped, clock-exact, independent, and idempotent', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'alpha' }],
      extensions: ['gtfs-realtime'],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await seedExpirationRows(gtfs);

      const current = await gtfs.realtime.cleanup({
        nowUnixSeconds: 100,
        snapshotHistory: false,
      });
      assert.equal(current.currentStateRowsDeleted, 7);
      assert.equal(current.snapshotHistoryRowsDeleted, 0);
      assert.equal(current.totalRowsDeleted, 7);

      const countsAfterCurrent = await gtfs.database.withKysely({
        callback: async (database) => ({
          alphaAlerts: Number(
            (
              await sql<{ count: number }>`select count(*) as count
                from alerts where source_id = 'alpha'`.execute(database)
            ).rows[0]!.count,
          ),
          betaAlerts: Number(
            (
              await sql<{ count: number }>`select count(*) as count
                from alerts where source_id = 'beta'`.execute(database)
            ).rows[0]!.count,
          ),
          alphaSnapshots: Number(
            (
              await sql<{ count: number }>`select count(*) as count
                from realtime_snapshots where source_id = 'alpha'`.execute(
                database,
              )
            ).rows[0]!.count,
          ),
        }),
      });
      assert.deepEqual(countsAfterCurrent, {
        alphaAlerts: 1,
        betaAlerts: 1,
        alphaSnapshots: 2,
      });

      const history = await gtfs.realtime.cleanup({
        nowUnixSeconds: 100,
        currentState: false,
      });
      assert.equal(history.currentStateRowsDeleted, 0);
      assert.equal(history.snapshotHistoryRowsDeleted, 4);
      assert.equal(history.deletedRowsByTable.realtime_feed_entities, 3);
      assert.equal(history.deletedRowsByTable.realtime_snapshots, 1);

      const retained = await gtfs.database.withKysely({
        callback: async (database) =>
          (
            await sql<{
              source_id: string;
              snapshot_id: string;
              raw_payload: string;
            }>`select source_id, snapshot_id, raw_payload
               from realtime_snapshots order by source_id`.execute(database)
          ).rows,
      });
      assert.deepEqual(retained, [
        {
          source_id: 'alpha',
          snapshot_id: 'live-snapshot',
          raw_payload: 'bGl2ZQ==',
        },
        {
          source_id: 'beta',
          snapshot_id: 'expired-snapshot',
          raw_payload: 'YmV0YQ==',
        },
      ]);

      const repeated = await gtfs.realtime.cleanup({ nowUnixSeconds: 100 });
      assert.equal(repeated.totalRowsDeleted, 0);
    } finally {
      await gtfs.close();
    }
  });

  test('rolls child cleanup back when a later delete fails', async () => {
    const sqlite = new Database(':memory:');
    const gtfs = new Gtfs({
      database: {
        client: sqlite,
      },
      sources: [{ sourceId: 'alpha' }],
      extensions: ['gtfs-realtime'],
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: async (database) => {
          await sql`insert into trip_updates
            (source_id, realtime_feed_id, entity_id, created_at_unix_seconds,
             expires_at_unix_seconds)
            values ('alpha', 'trip_updates', 'trip', 1, 100)`.execute(database);
          await sql`insert into trip_update_stop_time_updates
            (source_id, realtime_feed_id, trip_update_id,
             stop_time_update_ordinal, created_at_unix_seconds,
             expires_at_unix_seconds)
            values ('alpha', 'trip_updates', 'trip', 0, 1, 100)`.execute(
            database,
          );
        },
      });
      sqlite.exec(`create trigger reject_trip_cleanup
        before delete on trip_updates
        begin
          select raise(abort, 'injected cleanup failure');
        end`);

      await assert.rejects(
        gtfs.realtime.cleanup({
          nowUnixSeconds: 100,
          snapshotHistory: false,
        }),
        /injected cleanup failure/,
      );
      assert.equal(
        sqlite
          .prepare('select count(*) from trip_update_stop_time_updates')
          .pluck()
          .get(),
        1,
      );
      assert.equal(
        sqlite.prepare('select count(*) from trip_updates').pluck().get(),
        1,
      );
    } finally {
      await gtfs.close();
      sqlite.close();
    }
  });

  test('supports direct cleanup with an explicit empty source scope', async () => {
    const gtfs = new Gtfs({
      database: {},
      extensions: ['gtfs-realtime'],
    });
    try {
      await gtfs.schema.recreate();
      await seedExpirationRows(gtfs);
      const result = await gtfs.database.withKysely({
        callback: (database) =>
          cleanupGtfsRealtime({
            database,
            nowUnixSeconds: 100,
            extensions: ['gtfs-realtime'],
            sourceIds: [],
          }),
      });
      assert.equal(result.totalRowsDeleted, 0);
    } finally {
      await gtfs.close();
    }
  });
});
