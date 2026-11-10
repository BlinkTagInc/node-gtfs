import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importGtfs } from '../../src/index.ts';
import { refreshSqliteTripStatistics } from '../../src/database/sqlite/trip-statistics.ts';
import { refreshKyselySqliteTripStatistics } from '../../src/database/kysely/trip-statistics.ts';

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter} refreshes exact trip statistics on import, replacement and removal without changing caller settings`, async (t) => {
    const statements: string[] = [];
    const native = new Database(':memory:', {
      verbose: (statement) => statements.push(String(statement)),
    });
    const kysely = new Kysely({
      dialect: new SqliteDialect({ database: native }),
    });
    t.after(() => kysely.destroy());
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-trip-statistics-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    native.pragma('analysis_limit = 7');
    const client = adapter === 'native' ? native : kysely;
    const importSource = (sourceId: string) =>
      importGtfs({
        database: { client },
        sources: [
          {
            sourceId,
            schedule: {
              path: directory,
              import: { validation: { mode: 'off' } },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
    const writeTrips = (count: number) =>
      writeFile(
        path.join(directory, 'trips.txt'),
        [
          'route_id,service_id,trip_id',
          ...Array.from(
            { length: count },
            (_, index) => `r${index % 3},service,t${index}`,
          ),
        ].join('\n'),
      );
    const statistics = () =>
      native
        .prepare(
          "SELECT stat FROM sqlite_stat1 WHERE tbl = 'trips' AND idx = 'sqlite_autoindex_trips_1'",
        )
        .pluck()
        .get();
    await writeTrips(4000);
    assert.equal((await importSource('a')).success, true);
    assert.equal(statistics(), '4000 4000 1');
    assert.equal(native.pragma('analysis_limit', { simple: true }), 7);
    assert.equal((await importSource('b')).success, true);
    assert.equal(statistics(), '8000 4000 1');
    await writeTrips(2000);
    statements.length = 0;
    assert.equal((await importSource('a')).success, true);
    assert.equal(statistics(), '6000 3000 1');
    assert.equal(
      statements.some((statement) => statement.startsWith('CREATE INDEX')),
      false,
    );
    assert.equal(
      statements.filter((statement) => statement === 'ANALYZE "trips"').length,
      1,
    );
    assert.equal(
      native
        .prepare("SELECT count(*) FROM trips WHERE source_id = 'b'")
        .pluck()
        .get(),
      4000,
    );
    await rm(path.join(directory, 'trips.txt'));
    await writeFile(
      path.join(directory, 'stops.txt'),
      'stop_id,stop_name\nstop,Stop\n',
    );
    assert.equal((await importSource('a')).success, true);
    assert.equal(statistics(), '4000 4000 1');
    const before = native
      .prepare('SELECT * FROM trips ORDER BY source_id, trip_id')
      .all();
    await writeFile(
      path.join(directory, 'trips.txt'),
      'route_id,service_id,trip_id\nr,service,same\nr,service,same\n',
    );
    statements.length = 0;
    await assert.rejects(importSource('b'), /Could not store trips.txt/);
    assert.equal(
      statements.some((statement) => statement === 'ANALYZE "trips"'),
      false,
    );
    assert.deepEqual(
      native.prepare('SELECT * FROM trips ORDER BY source_id, trip_id').all(),
      before,
    );
    assert.equal(statistics(), '4000 4000 1');
    assert.equal(native.pragma('analysis_limit', { simple: true }), 7);
  });

  test(`${adapter} restores the analysis limit if statistics refresh fails`, async (t) => {
    const native = new Database(':memory:');
    const kysely = new Kysely({
      dialect: new SqliteDialect({ database: native }),
    });
    t.after(() => kysely.destroy());
    native.pragma('analysis_limit = 19');
    if (adapter === 'native') {
      assert.throws(() => refreshSqliteTripStatistics(native), /no such table/);
    } else {
      await assert.rejects(
        refreshKyselySqliteTripStatistics(kysely),
        /no such table/,
      );
    }
    assert.equal(native.pragma('analysis_limit', { simple: true }), 19);
  });
}

test('Kysely statistics refresh respects caller transaction rollback and preserves unrelated statistics', async (t) => {
  const native = new Database(':memory:');
  const kysely = new Kysely({
    dialect: new SqliteDialect({ database: native }),
  });
  t.after(() => kysely.destroy());
  native.exec(
    "CREATE TABLE trips(source_id TEXT, trip_id TEXT, PRIMARY KEY(source_id,trip_id)); CREATE TABLE other(id INTEGER PRIMARY KEY); INSERT INTO other VALUES (1); INSERT INTO trips VALUES ('a','t'); ANALYZE",
  );
  native.pragma('analysis_limit = 13');
  const before = native
    .prepare('SELECT * FROM sqlite_stat1 ORDER BY tbl,idx')
    .all();
  const failure = new Error('rollback');
  await assert.rejects(
    kysely.transaction().execute(async (transaction) => {
      native.exec("INSERT INTO trips VALUES ('a','new')");
      await refreshKyselySqliteTripStatistics(transaction);
      assert.equal(
        native
          .prepare("SELECT stat FROM sqlite_stat1 WHERE tbl = 'trips'")
          .pluck()
          .get(),
        '2 2 1',
      );
      assert.deepEqual(
        native.prepare("SELECT * FROM sqlite_stat1 WHERE tbl = 'other'").all(),
        before.filter((row) => (row as { tbl: string }).tbl === 'other'),
      );
      assert.equal(native.pragma('analysis_limit', { simple: true }), 13);
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    native.prepare('SELECT * FROM sqlite_stat1 ORDER BY tbl,idx').all(),
    before,
  );
  assert.equal(native.prepare('SELECT count(*) FROM trips').pluck().get(), 1);
});
