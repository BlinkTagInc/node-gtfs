import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { createSqliteImportTarget } from '../../src/database/sqlite/import-target.ts';
import { createKyselyImportTarget } from '../../src/database/kysely/import-target.ts';
import { inspectSqliteGtfsStoragePlan } from '../../src/database/sqlite/schema-inspector.ts';
import { inspectKyselyGtfsStoragePlan } from '../../src/database/kysely/schema-inspector.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { createDeferred } from '../helpers/deferred.ts';

describe('Schedule import targets', { timeout: 20_000 }, () => {
  it('serializes separate native targets sharing a handle and recovers after rollback', async (t) => {
    const database = new Database(':memory:');
    t.after(() => database.close());
    const storagePlan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.stops],
    });
    const first = createSqliteImportTarget({ database, storagePlan });
    const second = createSqliteImportTarget({ database, storagePlan });
    await first.initialize();
    const entered = createDeferred();
    const release = createDeferred();
    const failure = new Error('Abort first transaction');
    const firstResult = assert.rejects(
      first.runSourceTransaction(async () => {
        database
          .prepare('INSERT INTO stops (source_id, stop_id) VALUES (?, ?)')
          .run('source', 'rolled-back');
        entered.resolve();
        await release.promise;
        throw failure;
      }),
      (error) => error === failure,
    );
    await entered.promise;
    let secondEntered = false;
    const secondResult = second.runSourceTransaction(async () => {
      secondEntered = true;
      database
        .prepare('INSERT INTO stops (source_id, stop_id) VALUES (?, ?)')
        .run('source', 'committed');
    });
    try {
      await setImmediate();
      assert.equal(secondEntered, false);
    } finally {
      release.resolve();
      await Promise.all([firstResult, secondResult]);
    }
    assert.deepEqual(database.prepare('SELECT stop_id FROM stops').all(), [
      { stop_id: 'committed' },
    ]);
  });

  for (const adapter of ['native SQLite', 'Kysely SQLite']) {
    it(`${adapter} checks indexes only when requested and always checks table structure`, async (t) => {
      const sqlite = new Database(':memory:');
      const kysely = new Kysely({
        dialect: new SqliteDialect({ database: sqlite }),
      });
      t.after(() => kysely.destroy());
      const storagePlan = createGtfsStoragePlan({
        dialect: 'sqlite',
        tables: [compiledTableRegistry.stops],
      });
      const target =
        adapter === 'native SQLite'
          ? createSqliteImportTarget({ database: sqlite, storagePlan })
          : createKyselyImportTarget({ database: kysely, storagePlan });
      const inspect = (options: { readonly includeIndexes: boolean }) =>
        adapter === 'native SQLite'
          ? inspectSqliteGtfsStoragePlan(sqlite, storagePlan, options)
          : inspectKyselyGtfsStoragePlan(kysely, storagePlan, options);

      assert.equal((await target.initialize()).compatible, true);
      assert.equal((await inspect({ includeIndexes: false })).compatible, true);
      const withoutIndexes = await inspect({ includeIndexes: true });
      assert.equal(withoutIndexes.compatible, false);
      assert.deepEqual(
        withoutIndexes.tableIssues.flatMap(
          ({ missingIndexes }) => missingIndexes,
        ),
        storagePlan.tables.flatMap(({ indexes }) =>
          indexes.map(({ name }) => name),
        ),
      );
      let indexCreationNotices = 0;
      const onCreateIndexes = () => {
        indexCreationNotices += 1;
      };
      assert.equal((await target.finalize(onCreateIndexes)).compatible, true);
      assert.equal(indexCreationNotices, 1);
      assert.equal((await target.finalize(onCreateIndexes)).compatible, true);
      assert.equal(indexCreationNotices, 1);
      const indexName = storagePlan.tables[0]?.indexes[0]?.name;
      assert.ok(indexName);
      sqlite.exec(`DROP INDEX "${indexName}"`);
      assert.equal((await target.finalize(onCreateIndexes)).compatible, true);
      assert.equal(indexCreationNotices, 2);
      assert.equal((await inspect({ includeIndexes: true })).compatible, true);

      sqlite.exec('ALTER TABLE stops DROP COLUMN stop_url');
      const missingColumn = await inspect({ includeIndexes: false });
      assert.equal(missingColumn.compatible, false);
      assert.deepEqual(missingColumn.tableIssues[0]?.missingColumns, [
        'stop_url',
      ]);
      sqlite.exec('DROP TABLE stops');
      const missingTable = await inspect({ includeIndexes: false });
      assert.equal(missingTable.compatible, false);
      assert.equal(missingTable.tableIssues[0]?.missingTable, true);
    });

    it(`${adapter} reuses its immutable plan through nested transactions and rolls back source replacement`, async (t) => {
      const sqlite = new Database(':memory:');
      const kysely = new Kysely({
        dialect: new SqliteDialect({ database: sqlite }),
      });
      t.after(() => kysely.destroy());
      const table = compiledTableRegistry.stopTimes;
      const storagePlan = createGtfsStoragePlan({
        dialect: 'sqlite',
        tables: [table],
      });
      const target =
        adapter === 'native SQLite'
          ? createSqliteImportTarget({ database: sqlite, storagePlan })
          : createKyselyImportTarget({ database: kysely, storagePlan });
      assert.equal(target.storagePlan, storagePlan);
      assert.equal(Object.isFrozen(storagePlan), true);
      await target.initialize();
      const writerOptions = {
        table,
        filename: table.filename,
        sourceId: 'test',
        onDuplicateKey: 'reject' as const,
        reporting: { level: 'silent' as const },
      };
      const batch = (tripId: string) => {
        const position = {
          kind: 'csv',
          recordNumber: 1,
          csvLineNumber: 2,
        } as const;
        const row = normalizeGtfsRecord(
          {
            trip_id: tripId,
            stop_sequence: '1',
            arrival_time: '25:00:00',
            custom: 'retained',
          },
          table,
          { position, sourceId: 'test', onUnknownField: 'preserve' },
        );
        return { table, records: [{ row, position }], totalRecordCount: 1 };
      };
      await target.createWriter(writerOptions).writeBatch(batch('original'));
      const before = sqlite.prepare('SELECT * FROM stop_times').all();
      const failure = new Error('Abort replacement');
      await assert.rejects(
        () =>
          target.runSourceTransaction(async (transactionTarget) => {
            assert.equal(transactionTarget.storagePlan, storagePlan);
            assert.equal(
              transactionTarget.storagePlan.tables,
              storagePlan.tables,
            );
            await transactionTarget.deleteSourceData({
              sourceId: 'test',
              tableNames: [table.tableName],
            });
            await transactionTarget.runSourceTransaction(
              async (nestedTarget) => {
                assert.equal(nestedTarget, transactionTarget);
                await nestedTarget
                  .createWriter(writerOptions)
                  .writeBatch(batch('replacement'));
                assert.deepEqual(
                  await nestedTarget.findSourceDataTables({
                    sourceId: 'test',
                    tableNames: [table.tableName],
                  }),
                  [table.tableName],
                );
              },
            );
            throw failure;
          }),
        (error) => error === failure,
      );
      assert.deepEqual(
        sqlite.prepare('SELECT * FROM stop_times').all(),
        before,
      );

      await target.runSourceTransaction(async (transactionTarget) => {
        await transactionTarget.deleteSourceData({
          sourceId: 'test',
          tableNames: [table.tableName],
        });
        await transactionTarget
          .createWriter(writerOptions)
          .writeBatch(batch('committed'));
      });
      assert.deepEqual(
        sqlite.prepare('SELECT trip_id, _unknown_fields FROM stop_times').all(),
        [{ trip_id: 'committed', _unknown_fields: '{"custom":"retained"}' }],
      );
      assert.equal((await target.finalize()).compatible, true);
      assert.equal(sqlite.open, true);
    });
  }
});
