import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';

import { importGtfs } from '../../src/index.ts';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';
import { sql } from 'kysely';
import { closeSqliteDatabase, openSqliteDatabase } from '../../src/sqlite.ts';
import {
  beginUnsafeBulkSqlite,
  configureOwnedSqliteConnection,
  inspectSqlitePragmas,
} from '../../src/database/sqlite/durability.ts';

describe('SQLite durability policy', () => {
  test('owned file databases use WAL and FULL without overriding driver cache or temp defaults', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-durability-'));
    const controlPath = path.join(directory, 'control.sqlite');
    const managedPath = path.join(directory, 'managed.sqlite');
    const control = new Database(controlPath);
    const driverDefaults = inspectSqlitePragmas(control);
    control.close();
    const managed = openSqliteDatabase({ path: managedPath });

    try {
      const pragmas = inspectSqlitePragmas(managed);
      assert.equal(pragmas.journalMode, 'wal');
      assert.equal(pragmas.synchronous, 2);
      assert.equal(pragmas.foreignKeys, 1);
      assert.equal(pragmas.lockingMode, 'normal');
      assert.equal(pragmas.readUncommitted, 0);
      assert.equal(pragmas.tempStore, driverDefaults.tempStore);
      assert.equal(pragmas.cacheSize, driverDefaults.cacheSize);
    } finally {
      closeSqliteDatabase(managed);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('owned in-memory databases retain applicable in-memory defaults', () => {
    const control = new Database(':memory:');
    const expected = inspectSqlitePragmas(control);
    control.close();
    const managed = openSqliteDatabase({ path: ':memory:' });

    try {
      assert.deepEqual(inspectSqlitePragmas(managed), expected);
      assert.equal(expected.journalMode, 'memory');
      assert.equal(expected.synchronous, 2);
      assert.equal(expected.foreignKeys, 1);
    } finally {
      closeSqliteDatabase(managed);
    }
  });

  test('unsafe bulk mode disables recovery only until its restoration callback', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-unsafe-bulk-'));
    const db = new Database(path.join(directory, 'bulk.sqlite'));

    try {
      configureOwnedSqliteConnection(db, db.name);
      const before = inspectSqlitePragmas(db);
      const restore = beginUnsafeBulkSqlite(db);
      const during = inspectSqlitePragmas(db);
      assert.equal(during.journalMode, 'off');
      assert.equal(during.synchronous, 0);

      restore();
      restore();
      assert.deepEqual(inspectSqlitePragmas(db), before);
    } finally {
      db.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('unsafe bulk imports restore the original connection after a writer failure', async (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-unsafe-fail-'));
    const databasePath = path.join(directory, 'failed.sqlite');
    const gtfs = new Gtfs({
      database: {
        path: databasePath,
        durability: 'unsafe-bulk',
      },
      sources: [
        { sourceId: 'test', schedule: { path: 'test/fixtures/complete' } },
      ],
      reporting: { level: 'silent' },
    });
    const failedConnections: Database.Database[] = [];
    const originalPrepare = Database.prototype.prepare;
    t.mock.method(
      Database.prototype,
      'prepare',
      function (this: Database.Database, statement: string) {
        const prepared = originalPrepare.call(this, statement);
        if (
          this.name === databasePath &&
          /insert into "routes"/iu.test(statement)
        ) {
          t.mock.method(prepared, 'run', () => {
            failedConnections.push(this);
            assert.equal(this.pragma('journal_mode', { simple: true }), 'off');
            assert.equal(this.pragma('synchronous', { simple: true }), 0);
            throw new Error('Injected route writer failure');
          });
        }
        return prepared;
      },
    );

    try {
      await assert.rejects(gtfs.import(), {
        code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
      });
      assert.equal(failedConnections.length, 1);
      const [failedConnection] = failedConnections;
      assert.ok(
        failedConnection,
        'The failure must occur in unsafe mode during writing',
      );
      assert.equal(failedConnection.open, true);
      const pragmas = inspectSqlitePragmas(failedConnection);
      assert.equal(pragmas.journalMode, 'wal');
      assert.equal(pragmas.synchronous, 2);
    } finally {
      await gtfs.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  for (const schema of ['main', 'temp', 'attached'] as const) {
    test(`unsafe bulk rejects populated ${schema} tables before changing pragmas`, () => {
      const db = new Database(':memory:');
      try {
        if (schema === 'attached') {
          db.exec("ATTACH DATABASE ':memory:' AS attached");
        }
        db.exec(
          `CREATE TABLE ${schema}."application data" (id INTEGER); INSERT INTO ${schema}."application data" VALUES (1)`,
        );
        const before = inspectSqlitePragmas(db);
        assert.throws(
          () => beginUnsafeBulkSqlite(db),
          (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
            assert.match(error.message, /requires an empty database/);
            assert.deepEqual(error.details, {
              schema,
              table: 'application data',
            });
            return true;
          },
        );
        assert.deepEqual(inspectSqlitePragmas(db), before);
        assert.deepEqual(
          db.prepare(`SELECT * FROM ${schema}."application data"`).all(),
          [{ id: 1 }],
        );
      } finally {
        db.close();
      }
    });
  }

  test('unsafe bulk allows empty user tables with internal SQLite bookkeeping', () => {
    const db = new Database(':memory:');
    try {
      db.exec(
        'CREATE TABLE application_data (id INTEGER PRIMARY KEY AUTOINCREMENT); INSERT INTO application_data DEFAULT VALUES; DELETE FROM application_data',
      );
      assert.notEqual(
        db.prepare('SELECT 1 FROM sqlite_sequence').get(),
        undefined,
      );
      const before = inspectSqlitePragmas(db);
      const restore = beginUnsafeBulkSqlite(db);
      restore();
      assert.deepEqual(inspectSqlitePragmas(db), before);
    } finally {
      db.close();
    }
  });

  for (const recreate of [false, true]) {
    test(`unsafe bulk imports into ${recreate ? 'explicitly recreated' : 'new'} databases and refuses reimport`, async () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-empty-bulk-'));
      const databasePath = path.join(directory, 'bulk.sqlite');
      const gtfs = new Gtfs({
        database: {
          path: databasePath,
          durability: 'unsafe-bulk',
        },
        sources: ['first', 'second'].map((sourceId) => ({
          sourceId,
          schedule: { path: 'test/fixtures/complete' },
        })),
        reporting: { level: 'silent' },
      });
      try {
        if (recreate) {
          await gtfs.schema.recreate();
        }
        const result = await gtfs.import();
        assert.equal(result.success, true);
        const before = await gtfs.schedule.agency.all();
        assert.deepEqual(
          new Set(before.map((row) => row.source_id)),
          new Set(['first', 'second']),
        );
        await assert.rejects(gtfs.import(), {
          code: GtfsErrorCode.CONFIG_INVALID,
        });
        assert.deepEqual(await gtfs.schedule.agency.all(), before);
        await gtfs.database.withKysely({
          callback: async (database) => {
            assert.deepEqual(
              (await sql`PRAGMA journal_mode`.execute(database)).rows,
              [{ journal_mode: 'wal' }],
            );
            assert.deepEqual(
              (await sql`PRAGMA synchronous`.execute(database)).rows,
              [{ synchronous: 2 }],
            );
          },
        });
      } finally {
        await gtfs.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
  }

  test('caller-owned connections retain every durability pragma', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-borrowed-db-'));
    const db = new Database(':memory:');
    db.pragma('synchronous = OFF');
    db.pragma('foreign_keys = OFF');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -1000');
    db.pragma('read_uncommitted = ON');
    const before = inspectSqlitePragmas(db);

    try {
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'borrowed',
            schedule: {
              path: directory,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      assert.deepEqual(inspectSqlitePragmas(db), before);
    } finally {
      db.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
