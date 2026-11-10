import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
  sql,
  type DatabaseConnection,
} from 'kysely';
import mysql from 'mysql2';
import pg from 'pg';
import Cursor from 'pg-cursor';
import { Gtfs, GtfsErrorCode } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/database.ts';
import { createDeferred } from '../helpers/deferred.ts';

async function serverFixture(
  t: TestContext,
  dialect: 'postgres' | 'mysql',
  url: string,
) {
  let onReserve:
    ((connection: DatabaseConnection) => Promise<void>) | undefined;
  const releases: (() => void)[] = [];
  const database = new Kysely<GtfsDatabase>({
    dialect:
      dialect === 'postgres'
        ? new PostgresDialect({
            pool: new pg.Pool({ connectionString: url, max: 3 }),
            cursor: Cursor,
            onReserveConnection: async (connection) => onReserve?.(connection),
          })
        : new MysqlDialect({
            pool: mysql.createPool({ uri: url, connectionLimit: 3 }),
            onReserveConnection: async (connection) => onReserve?.(connection),
          }),
  });
  const gtfs = new Gtfs({
    database: { client: database },
    sources: [
      { sourceId: 'north', schedule: { path: 'test/fixtures/complete' } },
    ],
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    for (const release of releases) {
      release();
    }
    await gtfs.close();
    await database.destroy();
  });
  await gtfs.schema.recreate();
  assert.equal((await gtfs.import()).success, true);
  return {
    database,
    gtfs,
    gate() {
      const entered = createDeferred();
      const release = createDeferred();
      releases.push(release.resolve);
      return { entered, release };
    },
    reserve(callback: (connection: DatabaseConnection) => Promise<void>) {
      onReserve = callback;
    },
  };
}

for (const dialect of ['postgres', 'mysql'] as const) {
  const url =
    dialect === 'postgres'
      ? process.env.GTFS_TEST_POSTGRES_URL
      : process.env.GTFS_TEST_MYSQL_URL;
  describe(`${dialect} operation concurrency`, { skip: !url }, () => {
    test(
      'reads overlap; writers wait for earlier reads and block later reads; close drains all accepted work',
      { timeout: 30_000 },
      async (t) => {
        const fixture = await serverFixture(t, dialect, url!);
        const { database, gtfs } = fixture;
        const firstRead = fixture.gate();
        const writer = fixture.gate();
        const connections = new Set<DatabaseConnection>();
        let hold = true;
        fixture.reserve(async (connection) => {
          connections.add(connection);
          if (hold) {
            hold = false;
            firstRead.entered.resolve();
            await firstRead.release.promise;
          }
        });
        const events: string[] = [];
        const first = gtfs.schedule.routes.all().then((rows) => {
          events.push('first read');
          return rows;
        });
        await firstRead.entered.promise;
        // This must finish while the first read still owns a real pool connection.
        assert.equal(await gtfs.schedule.routes.count(), 2);
        assert.equal(connections.size, 2);
        assert.ok((await gtfs.query.stops().all()).length > 0);
        assert.ok((await gtfs.geojson.stops()).features.length > 0);
        assert.equal((await gtfs.schema.validate()).compatible, true);
        assert.deepEqual([...events], []);
        const mutation = gtfs.database.withKysely({
          callback: (db) =>
            db.transaction().execute(async (transaction) => {
              events.push('writer');
              assert.deepEqual(events, ['first read', 'writer']);
              await transaction
                .updateTable('routes')
                .set({ route_short_name: 'committed' })
                .where('route_id', '=', 'FR1')
                .execute();
              writer.entered.resolve();
              await writer.release.promise;
            }),
        });
        const later = gtfs.schedule.routes
          .first({ route_id: 'FR1' })
          .then((row) => {
            events.push('later read');
            return row;
          });
        firstRead.release.resolve();
        await writer.entered.promise;
        // An unrelated pool query has not joined the transaction.
        const outside = await database
          .selectFrom('routes')
          .select('route_short_name')
          .where('route_id', '=', 'FR1')
          .executeTakeFirstOrThrow();
        assert.equal(outside.route_short_name, 'R1');
        assert.deepEqual(events, ['first read', 'writer']);
        const closing = gtfs.close();
        assert.equal(gtfs.isClosed, false);
        await assert.rejects(gtfs.schedule.routes.count(), {
          code: GtfsErrorCode.INSTANCE_CLOSED,
        });
        writer.release.resolve();
        await Promise.all([first, mutation, closing]);
        assert.equal((await later)?.route_short_name, 'committed');
        assert.deepEqual(events, ['first read', 'writer', 'later read']);
        assert.equal(gtfs.isClosed, true);
        // The supplied pool is still owned by the caller.
        await sql`select 1`.execute(database);
      },
    );

    test(
      'close waits for every overlapping read, even when the last read finishes first',
      { timeout: 30_000 },
      async (t) => {
        const fixture = await serverFixture(t, dialect, url!);
        const { database, gtfs } = fixture;
        const held = [fixture.gate(), fixture.gate()];
        let index = 0;
        fixture.reserve(async () => {
          const gate = held[index++];
          if (gate) {
            gate.entered.resolve();
            await gate.release.promise;
          }
        });
        const first = gtfs.schedule.routes.count();
        await held[0]!.entered.promise;
        const second = gtfs.schedule.routes.count();
        await held[1]!.entered.promise;
        const closing = gtfs.close();
        held[1]!.release.resolve();
        assert.equal(await second, 2);
        await sql`select 1`.execute(database);
        assert.equal(gtfs.isClosed, false);
        held[0]!.release.resolve();
        assert.equal(await first, 2);
        await closing;
        assert.equal(gtfs.isClosed, true);
      },
    );

    test(
      'rollback and read failures release their reservations',
      { timeout: 30_000 },
      async (t) => {
        const { database, gtfs } = await serverFixture(t, dialect, url!);
        const failure = new Error('rollback this callback');
        const mutation = gtfs.database.withKysely({
          callback: (db) =>
            db.transaction().execute(async (transaction) => {
              await transaction
                .updateTable('routes')
                .set({ route_short_name: 'rollback' })
                .where('route_id', '=', 'FR1')
                .execute();
              throw failure;
            }),
        });
        const read = gtfs.schedule.routes.first({ route_id: 'FR1' });
        await assert.rejects(mutation, (error) => error === failure);
        assert.equal((await read)?.route_short_name, 'R1');

        await database.schema.dropTable('agency').execute();
        const failed = gtfs.schedule.agency.all();
        const healthy = gtfs.schedule.routes.count();
        await assert.rejects(failed, { code: GtfsErrorCode.SCHEMA_INVALID });
        assert.equal(await healthy, 2);
        await gtfs.schema.ensure();
        assert.deepEqual(await gtfs.schedule.agency.all(), []);
      },
    );

    test(
      'multiple streams allow other reads, release on failure and early return, and close releases every cursor',
      { timeout: 30_000 },
      async (t) => {
        const { database, gtfs } = await serverFixture(t, dialect, url!);
        const first = gtfs.schedule.routes.stream();
        const second = gtfs.schedule.routes.stream();
        assert.equal((await first.next()).done, false);
        assert.equal((await second.next()).done, false);
        assert.equal(await gtfs.schedule.routes.count(), 2);
        await assert.rejects(gtfs.schema.recreate(), {
          code: GtfsErrorCode.QUERY_INVALID,
          details: { reason: 'STREAM_ACTIVE' },
        });
        await assert.rejects(
          gtfs.database.withKysely({ callback: () => undefined }),
          {
            details: { reason: 'STREAM_ACTIVE' },
          },
        );
        await first.return!();
        await database.schema.dropTable('agency').execute();
        await assert.rejects(gtfs.schedule.agency.stream().next(), {
          code: GtfsErrorCode.SCHEMA_INVALID,
        });
        for await (const _row of gtfs.schedule.routes.stream()) {
          break;
        }
        const third = gtfs.schedule.routes.stream();
        assert.equal((await third.next()).done, false);
        await gtfs.close();
        assert.equal((await second.next()).done, true);
        assert.equal((await third.next()).done, true);
        // Require every slot at once so leaked cursors cannot hide behind spare slots.
        const allAcquired = createDeferred();
        let acquired = 0;
        await Promise.all(
          Array.from({ length: 3 }, () =>
            database.connection().execute(async (connection) => {
              acquired += 1;
              if (acquired === 3) {
                allAcquired.resolve();
              }
              await allAcquired.promise;
              await sql`select 1`.execute(connection);
            }),
          ),
        );
      },
    );

    test(
      'closing while two streams wait for an exclusive callback releases both reservations',
      { timeout: 30_000 },
      async (t) => {
        const fixture = await serverFixture(t, dialect, url!);
        const { database, gtfs } = fixture;
        const callback = fixture.gate();
        const pending = gtfs.database.withKysely({
          callback: async (db) => {
            await sql`select 1`.execute(db);
            callback.entered.resolve();
            await callback.release.promise;
          },
        });
        await callback.entered.promise;
        const first = gtfs.schedule.routes.stream().next();
        const second = gtfs.schedule.routes.stream().next();
        const failures = Promise.all([
          assert.rejects(first, { code: GtfsErrorCode.INSTANCE_CLOSED }),
          assert.rejects(second, { code: GtfsErrorCode.INSTANCE_CLOSED }),
        ]);
        const closing = gtfs.close();
        callback.release.resolve();
        await Promise.all([pending, failures, closing]);
        await sql`select 1`.execute(database);
      },
    );

    test(
      'a borrowed transaction keeps single-connection stream exclusion',
      { timeout: 30_000 },
      async (t) => {
        const { database } = await serverFixture(t, dialect, url!);
        await database.transaction().execute(async (transaction) => {
          const gtfs = new Gtfs<GtfsDatabase>({
            database: { client: transaction },
          });
          try {
            const stream = gtfs.schedule.routes.stream();
            assert.equal((await stream.next()).done, false);
            await assert.rejects(gtfs.schedule.routes.count(), {
              details: { reason: 'STREAM_ACTIVE' },
            });
            await stream.return!();
            assert.equal(await gtfs.schedule.routes.count(), 2);
          } finally {
            await gtfs.close();
          }
          await sql`select 1`.execute(transaction);
        });
      },
    );
  });
}

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter} SQLite keeps reads outside a pending callback transaction`, async () => {
    const sqlite = new Database(':memory:');
    const database = new Kysely<GtfsDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const gtfs = new Gtfs({
      database: { client: adapter === 'native' ? sqlite : database },
    });
    const entered = createDeferred();
    const release = createDeferred();
    try {
      await gtfs.schema.ensure();
      const failure = new Error('rollback');
      const mutation = gtfs.database.withKysely({
        callback: (db) =>
          db.transaction().execute(async (transaction) => {
            await transaction
              .insertInto('routes')
              .values({ source_id: 'north', route_id: 'new', route_type: 3 })
              .execute();
            entered.resolve();
            await release.promise;
            throw failure;
          }),
      });
      const rejected = assert.rejects(mutation, (error) => error === failure);
      await entered.promise;
      const read = gtfs.schedule.routes.all();
      release.resolve();
      await rejected;
      assert.deepEqual(await read, []);
    } finally {
      release.resolve();
      await gtfs.close();
      await database.destroy();
    }
  });
}
