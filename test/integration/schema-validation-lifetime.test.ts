import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';

async function fixture(
  t: TestContext,
  mode: 'owned' | 'borrowed-native' | 'borrowed-kysely',
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-schema-lifetime-'));
  const filename = path.join(directory, 'transit.sqlite');
  const admin = new Database(filename);
  const native = mode === 'owned' ? undefined : new Database(filename);
  const kysely =
    mode === 'borrowed-kysely' && native
      ? new Kysely({ dialect: new SqliteDialect({ database: native }) })
      : undefined;
  const gtfs = new Gtfs({
    database: native ? { client: kysely ?? native } : { path: filename },
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    await gtfs.close();
    if (kysely) {
      await kysely.destroy();
    } else if (native) {
      native.close();
    }
    admin.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { gtfs, admin, filename };
}

for (const mode of ['owned', 'borrowed-native', 'borrowed-kysely'] as const) {
  test(`${mode}: schema checks recover from missing tables and external DDL without reopening`, async (t) => {
    const { gtfs, admin } = await fixture(t, mode);
    const routes = gtfs.schedule.routes;
    assert.equal((await gtfs.schema.validate()).compatible, false);
    await assert.rejects(routes.all(), (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
      assert.match(JSON.stringify(error.details), /"missingTable":true/);
      return true;
    });
    await gtfs.schema.ensure();
    assert.deepEqual(await routes.all(), []);
    assert.equal(await routes.first(), null);
    assert.equal(await routes.count(), 0);
    await assert.rejects(routes.firstOrThrow(), {
      code: GtfsErrorCode.QUERY_INVALID,
      details: { reason: 'NO_ROWS' },
    });
    assert.equal((await gtfs.schema.validate()).compatible, true);

    // Even an already-created stream checks the schema when iteration starts.
    const stream = routes.stream();
    admin.exec(
      'ALTER TABLE routes RENAME COLUMN route_short_name TO wrong_name',
    );
    const inspection = await gtfs.schema.validate();
    assert.equal(inspection.compatible, false);
    assert.ok(
      inspection.tableIssues.some((issue) =>
        issue.missingColumns.includes('route_short_name'),
      ),
    );
    await assert.rejects(gtfs.schema.ensure(), {
      code: GtfsErrorCode.SCHEMA_INVALID,
    });
    for (const read of [
      () => routes.all(),
      () => routes.first(),
      () => routes.firstOrThrow(),
      () => routes.count(),
      () => stream.next(),
    ]) {
      await assert.rejects(read, (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        assert.match(JSON.stringify(error.details), /route_short_name/);
        return true;
      });
    }
    admin.exec(
      'ALTER TABLE routes RENAME COLUMN wrong_name TO route_short_name',
    );
    assert.deepEqual(await routes.all(), []);
    assert.deepEqual(await routes.stream().next(), {
      value: undefined,
      done: true,
    });
    assert.equal((await gtfs.schema.validate()).compatible, true);
    await assert.rejects(gtfs.gtfsPlus.directions.all(), {
      code: GtfsErrorCode.EXTENSION_DISABLED,
    });
  });

  test(`${mode}: a second instance can recreate, import and repair the shared schema`, async (t) => {
    const { gtfs, admin, filename } = await fixture(t, mode);
    const writerClient =
      mode === 'borrowed-kysely'
        ? new Kysely({
            dialect: new SqliteDialect({ database: new Database(filename) }),
          })
        : undefined;
    const writer = new Gtfs({
      database: writerClient ? { client: writerClient } : { path: filename },
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.ensure();
      admin.exec(`CREATE TABLE application_data (id INTEGER);
        INSERT INTO application_data VALUES (1);
        INSERT INTO routes (source_id, route_id, route_type)
        VALUES ('north', 'old', 3)`);
      const routes = gtfs.schedule.routes.select('route_id');
      assert.deepEqual(await routes.all(), [{ route_id: 'old' }]);
      await writer.schema.recreate();
      assert.deepEqual(await routes.all(), []);
      assert.equal(
        (
          await writer.import({
            sources: [
              {
                sourceId: 'north',
                schedule: { path: 'test/fixtures/caltrain_20160406.zip' },
              },
            ],
          })
        ).success,
        true,
      );
      assert.equal(await routes.count(), 4);

      // Full-schema validation reports unrelated drift without poisoning a read.
      admin.exec('DROP TABLE agency');
      assert.equal((await gtfs.schema.validate()).compatible, false);
      assert.equal(await routes.count(), 4);
      await writer.schema.ensure();
      const repaired = await gtfs.schema.validate();
      assert.equal(repaired.compatible, true, JSON.stringify(repaired));

      admin.exec('DROP TABLE routes');
      await assert.rejects(routes.all(), {
        code: GtfsErrorCode.SCHEMA_INVALID,
      });
      await writer.schema.ensure();
      assert.deepEqual(await routes.all(), []);
      assert.deepEqual(admin.prepare('SELECT * FROM application_data').all(), [
        { id: 1 },
      ]);
    } finally {
      await writer.close();
      if (writerClient) {
        await writerClient.destroy();
      }
    }
  });
}
