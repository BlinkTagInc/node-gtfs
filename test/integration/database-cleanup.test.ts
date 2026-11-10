import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  Gtfs,
  GtfsError,
  importGtfs,
  isGtfsError,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { beginUnsafeBulkSqlite } from '../../src/database/sqlite/durability.ts';
import { refreshSqliteTripStatistics } from '../../src/database/sqlite/trip-statistics.ts';
import { refreshKyselySqliteTripStatistics } from '../../src/database/kysely/trip-statistics.ts';

function recoveryError(error: unknown) {
  assert.ok(isGtfsError(error));
  assert.equal(error.details?.databaseRecoveryRequired, true);
  return error;
}

for (const borrowed of [false, true]) {
  test(`native SQLite: failed ${borrowed ? 'savepoint' : 'transaction'} rollback stops source continuation`, async (t) => {
    const native = new Database(':memory:');
    const gtfs = new Gtfs({
      database: { client: native },
      reporting: { level: 'silent' },
    });
    t.after(async () => {
      t.mock.restoreAll();
      await gtfs.close();
      native.close();
    });
    await gtfs.schema.recreate();
    if (borrowed) {
      native.exec('BEGIN');
    }
    const primary = new GtfsError('write failed', {
      code: 'GTFS_DATABASE_OPERATION_FAILED',
    });
    const cleanup = new Error('rollback failed');
    const prepare = native.prepare.bind(native);
    const exec = native.exec.bind(native);
    let inserts = 0;
    t.mock.method(native, 'prepare', (statement: string) => {
      if (/^insert into "routes"/i.test(statement)) {
        inserts += 1;
        throw primary;
      }
      return prepare(statement);
    });
    t.mock.method(native, 'exec', (statement: string) => {
      if (statement.startsWith('ROLLBACK')) {
        throw cleanup;
      }
      return exec(statement);
    });
    await assert.rejects(
      gtfs.import({
        sources: ['first', 'second'].map((sourceId) => ({
          sourceId,
          schedule: {
            path: 'test/fixtures/complete',
            import: { onSourceError: 'continue' as const },
          },
        })),
      }),
      (error) => {
        const failure = recoveryError(error);
        assert.ok(failure.cause instanceof AggregateError);
        assert.deepEqual(failure.cause.errors, [primary, cleanup]);
        return true;
      },
    );
    assert.equal(inserts, 1);
    assert.equal(native.inTransaction, true);
    t.mock.restoreAll();
    native.exec('ROLLBACK');
    assert.deepEqual(native.prepare('SELECT * FROM agency').all(), []);
  });
}

for (const primary of [new Error('configuration failed'), undefined]) {
  test(`failed SQLite setup retains the ${primary === undefined ? 'undefined rejection' : 'open error'} when closing also fails`, (t) => {
    const cleanup = new Error('close failed');
    const close = Database.prototype.close;
    t.mock.method(Database.prototype, 'pragma', () => {
      throw primary;
    });
    t.mock.method(
      Database.prototype,
      'close',
      function (this: Database.Database) {
        close.call(this);
        throw cleanup;
      },
    );
    assert.throws(
      () => new Gtfs({ database: { path: ':memory:' } }),
      (error) => {
        const failure = recoveryError(error);
        assert.equal(failure.code, 'GTFS_DATABASE_OPEN_FAILED');
        assert.ok(failure.cause instanceof AggregateError);
        const original: unknown = failure.cause.errors[0];
        assert.ok(isGtfsError(original));
        assert.equal(original.cause, primary);
        assert.equal(failure.cause.errors[1], cleanup);
        return true;
      },
    );
  });
}

for (const adapter of ['native', 'kysely'] as const) {
  for (const failAnalysis of [false, true]) {
    test(`${adapter}: statistics restoration failure retains ${failAnalysis ? 'both failures' : 'the cleanup failure'}`, async (t) => {
      const native = new Database(':memory:');
      const db = new Kysely({
        dialect: new SqliteDialect({ database: native }),
      });
      t.after(() => db.destroy());
      native.exec('CREATE TABLE trips (id INTEGER)');
      native.pragma('analysis_limit = 19');
      const primary = new Error('analysis failed');
      const cleanup = new Error('restore failed');
      const pragma = native.pragma.bind(native);
      const prepare = native.prepare.bind(native);
      const exec = native.exec.bind(native);
      t.mock.method(
        native,
        'pragma',
        (statement: string, options?: Database.PragmaOptions) => {
          if (statement === 'analysis_limit = 19') {
            throw cleanup;
          }
          return pragma(statement, options);
        },
      );
      t.mock.method(native, 'exec', (statement: string) => {
        if (failAnalysis && statement.startsWith('ANALYZE')) {
          throw primary;
        }
        return exec(statement);
      });
      t.mock.method(native, 'prepare', (statement: string) => {
        if (statement === 'PRAGMA analysis_limit = 19') {
          throw cleanup;
        }
        if (failAnalysis && statement.startsWith('ANALYZE')) {
          throw primary;
        }
        return prepare(statement);
      });
      await assert.rejects(
        async () => {
          if (adapter === 'native') {
            refreshSqliteTripStatistics(native);
          } else {
            await refreshKyselySqliteTripStatistics(db);
          }
        },
        (error) => {
          const failure = recoveryError(error);
          if (failAnalysis) {
            assert.ok(failure.cause instanceof AggregateError);
            assert.deepEqual(failure.cause.errors, [primary, cleanup]);
          } else {
            assert.equal(failure.cause, cleanup);
          }
          return true;
        },
      );
      t.mock.restoreAll();
      assert.equal(native.open, true);
      assert.equal(native.pragma('analysis_limit', { simple: true }), 0);
      native.pragma('analysis_limit = 19');
      await refreshKyselySqliteTripStatistics(db);
      assert.equal(native.pragma('analysis_limit', { simple: true }), 19);
    });
  }
}

test('unsafe durability setup preserves the original failure when restoration also fails', (t) => {
  const native = new Database(':memory:');
  t.after(() => native.close());
  const primary = new Error('disable journal failed');
  const cleanup = new Error('restore journal failed');
  const pragma = native.pragma.bind(native);
  t.mock.method(
    native,
    'pragma',
    (statement: string, options?: Database.PragmaOptions) => {
      if (statement === 'journal_mode = OFF') {
        throw primary;
      }
      if (statement === 'journal_mode = memory') {
        throw cleanup;
      }
      return pragma(statement, options);
    },
  );
  assert.throws(
    () => beginUnsafeBulkSqlite(native),
    (error) => {
      const failure = recoveryError(error);
      assert.ok(failure.cause instanceof AggregateError);
      assert.deepEqual(failure.cause.errors, [primary, cleanup]);
      return true;
    },
  );
});

for (const failWrite of [false, true]) {
  test(`import durability cleanup ${failWrite ? 'retains the write error' : 'rejects after committed writes'} and does not report success`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cleanup-'));
    const filename = path.join(directory, 'feed.sqlite');
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: { path: filename, durability: 'unsafe-bulk' },
      sources: [{ schedule: { path: 'test/fixtures/complete' } }],
      reporting: { reporter: (event) => events.push(event) },
    });
    t.after(async () => {
      await gtfs.close();
      await rm(directory, { recursive: true, force: true });
    });
    const primary = new Error('write failed');
    const cleanup = new Error('restore journal failed');
    let writing = false;
    const prepare = Database.prototype.prepare;
    t.mock.method(
      Database.prototype,
      'prepare',
      function (this: Database.Database, statement: string) {
        if (
          this.name === filename &&
          /^insert into "routes"/i.test(statement)
        ) {
          writing = true;
          if (failWrite) {
            throw primary;
          }
        }
        return prepare.call(this, statement);
      },
    );
    const pragma = Database.prototype.pragma;
    t.mock.method(
      Database.prototype,
      'pragma',
      function (
        this: Database.Database,
        statement: string,
        options?: Database.PragmaOptions,
      ) {
        if (
          this.name === filename &&
          writing &&
          statement === 'journal_mode = wal'
        ) {
          throw cleanup;
        }
        return pragma.call(this, statement, options);
      },
    );
    await assert.rejects(gtfs.import(), (error) => {
      const failure = recoveryError(error);
      if (failWrite) {
        assert.ok(failure.cause instanceof AggregateError);
        const original: unknown = failure.cause.errors[0];
        assert.ok(isGtfsError(original));
        assert.equal(original.cause, primary);
        assert.equal(failure.cause.errors[1], cleanup);
      } else {
        assert.equal(failure.cause, cleanup);
      }
      return true;
    });
    assert.equal(
      events.some((event) => event.type === 'operation:complete'),
      false,
    );
  });
}

test('one-shot import preserves the source error when owned connection shutdown also fails', async (t) => {
  const cleanup = new Error('close failed');
  const close = Database.prototype.close;
  let closed = 0;
  t.mock.method(
    Database.prototype,
    'close',
    function (this: Database.Database) {
      close.call(this);
      closed += 1;
      throw cleanup;
    },
  );
  await assert.rejects(
    importGtfs({
      database: { path: ':memory:' },
      sources: [{ schedule: { path: 'test/fixtures/does-not-exist' } }],
      reporting: { level: 'silent' },
    }),
    (error) => {
      const failure = recoveryError(error);
      assert.equal(failure.code, 'GTFS_SOURCE_READ_FAILED');
      assert.ok(failure.cause instanceof AggregateError);
      assert.ok(isGtfsError(failure.cause.errors[0]));
      const shutdown: unknown = failure.cause.errors[1];
      assert.ok(isGtfsError(shutdown));
      assert.equal(shutdown.cause, cleanup);
      return true;
    },
  );
  assert.equal(closed, 1);
});
