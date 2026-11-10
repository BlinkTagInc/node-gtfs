import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import {
  stageGtfsSource,
  importGtfsSourceDirectly,
} from '../../src/schedule/import/process-source.ts';
import { importGtfs } from '../../src/operations.ts';
import { fileBackedTables } from '../../src/schema/table-registry.ts';
import type { NormalizedImportRowBatch } from '../../src/schedule/import/records.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import { setImmediate } from 'node:timers/promises';
import { createDeferred } from '../helpers/deferred.ts';

for (const fails of [false, true]) {
  test(
    `direct import waits for each writer batch and ${fails ? 'stops on rejection' : 'resumes in order'}`,
    { timeout: 5000 },
    async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-write-backpressure-'),
      );
      t.after(() => rm(directory, { recursive: true, force: true }));
      await writeFile(
        path.join(directory, 'routes.txt'),
        'route_id,route_type\n1,3\n2,3\n3,3\n4,3\n5,3\n',
      );
      const entered = createDeferred();
      const release = createDeferred();
      const failure = new Error('writer rejected batch');
      const batches: string[][] = [];
      const operation = importGtfsSourceDirectly({
        options: {
          directory,
          tables: fileBackedTables,
          sourceId: 'source',
          mode: 'off',
          onUnknownField: 'preserve',
          onDuplicateKey: 'reject',
        },
        sink: {
          batchSize: 2,
          async writeBatch(batch) {
            batches.push(batch.records.map(({ row }) => String(row.route_id)));
            if (batches.length === 1) {
              entered.resolve();
              await release.promise;
              if (fails) {
                throw failure;
              }
            }
          },
        },
      });
      const settled = fails
        ? assert.rejects(operation, (error: unknown) => error === failure)
        : operation;
      await entered.promise;
      try {
        await setImmediate();
        assert.deepEqual(batches, [['1', '2']]);
      } finally {
        release.resolve();
        await settled;
      }
      assert.deepEqual(
        batches,
        fails ? [['1', '2']] : [['1', '2'], ['3', '4'], ['5']],
      );
    },
  );
}

test('direct normalized batches match staged records, stay bounded, and do not write row payloads', async (t) => {
  const options = {
    directory: 'test/fixtures/complete',
    tables: fileBackedTables.filter(
      (table) => table.specification === 'gtfs-schedule',
    ),
    sourceId: 'test',
    defaultAgencyId: 'fallback',
    mode: 'off' as const,
    onUnknownField: 'preserve' as const,
    onDuplicateKey: 'reject' as const,
  };
  const staged = await stageGtfsSource(options);
  t.after(() => staged.close());
  const prepare = Database.prototype.prepare;
  const workingDirectories = new Set<string>();
  t.mock.method(
    Database.prototype,
    'prepare',
    function (this: Database.Database, sql: string) {
      const statement = prepare.call(this, sql);
      if (path.basename(this.name) === 'records.sqlite') {
        workingDirectories.add(path.dirname(this.name));
        if (
          /^INSERT INTO (records|reference_rows|record_keys|reference_values)\b/u.test(
            sql,
          )
        ) {
          t.mock.method(statement, 'run', () =>
            assert.fail('Unexpected row staging'),
          );
        }
      }
      return statement;
    },
  );
  const batches: NormalizedImportRowBatch[] = [];
  const imported = await importGtfsSourceDirectly({
    options,
    sink: {
      batchSize: 3,
      async writeBatch(batch) {
        assert.ok(batch.records.length > 0 && batch.records.length <= 3);
        for (const { row, position } of batch.records) {
          assert.ok(Object.isFrozen(row));
          assert.ok(Object.isFrozen(position));
        }
        await Promise.resolve();
        batches.push(batch);
      },
    },
  });
  assert.deepEqual(imported.files, staged.files);
  assert.deepEqual(imported.validation, staged.validation);
  assert.equal(imported.defaultAgencyId, staged.defaultAgencyId);
  for (const table of options.tables) {
    const count = staged.files.get(table.filename)?.totalRecordCount ?? 0;
    assert.deepEqual(
      batches.filter((batch) => batch.table === table),
      [...staged.batches(table, 3, count)],
      table.filename,
    );
  }
  assert.equal(workingDirectories.size, 1);
  for (const directory of workingDirectories) {
    await assert.rejects(stat(directory), { code: 'ENOENT' });
  }
});

test('a late direct write failure restores the entire source and preserves another source', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-direct-rollback-'));
  const database = new Database(':memory:');
  t.after(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });
  const run = (sourceId: string) =>
    importGtfs({
      database: { client: database },
      sources: [{ sourceId, schedule: { path: directory } }],
      reporting: { level: 'silent' },
    });
  await writeFile(
    path.join(directory, 'routes.txt'),
    'route_id,route_type,route_long_name\nroute,3,Original route\n',
  );
  await writeFile(
    path.join(directory, 'stops.txt'),
    'stop_id,stop_name,stop_lat\nold,Original stop,0\n',
  );
  await run('target');
  await run('other');
  const before = {
    routes: database.prepare('SELECT * FROM routes ORDER BY source_id').all(),
    stops: database.prepare('SELECT * FROM stops ORDER BY source_id').all(),
  };
  await writeFile(
    path.join(directory, 'routes.txt'),
    'route_id,route_type,route_long_name\nnew,3,Replacement\n',
  );
  const records = Array.from(
    { length: 100_000 },
    (_, index) => `${index},${index === 0 ? '"first\nline"' : 'Stop'},0\n`,
  ).join('');
  await writeFile(
    path.join(directory, 'stops.txt'),
    `stop_id,stop_name,stop_lat\n${records}late,Invalid,91\n`,
  );
  let successfulWrites = 0;
  const prepare = database.prepare.bind(database);
  t.mock.method(database, 'prepare', (sql: string) => {
    const statement = prepare(sql);
    if (sql.startsWith('INSERT INTO "stops"')) {
      const run = statement.run.bind(statement);
      t.mock.method(statement, 'run', (...values: unknown[]) => {
        const result = run(...values);
        successfulWrites += result.changes;
        return result;
      });
    }
    return statement;
  });
  await assert.rejects(run('target'), (error) => {
    assert.ok(isGtfsError(error));
    assert.equal(error.code, GtfsErrorCode.DATABASE_OPERATION_FAILED);
    assert.deepEqual(error.position, {
      kind: 'csv',
      recordNumber: 100_001,
      csvLineNumber: 100_003,
    });
    return true;
  });
  assert.equal(successfulWrites, 100_000);
  assert.equal(database.inTransaction, false);
  assert.deepEqual(
    {
      routes: database.prepare('SELECT * FROM routes ORDER BY source_id').all(),
      stops: database.prepare('SELECT * FROM stops ORDER BY source_id').all(),
    },
    before,
  );
  await writeFile(
    path.join(directory, 'stops.txt'),
    'stop_id,stop_name,stop_lat\nnew,Recovered,0\n',
  );
  assert.equal((await run('target')).success, true);
  assert.deepEqual(
    database
      .prepare('SELECT source_id,stop_id FROM stops ORDER BY source_id')
      .all(),
    [
      { source_id: 'other', stop_id: 'old' },
      { source_id: 'target', stop_id: 'new' },
    ],
  );
});

test('direct CSV delivery reads once and closes streams and working storage when its consumer fails', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-direct-consumer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'stops.txt'),
    `stop_id\n${Array.from({ length: 1000 }, (_, index) => `${index}\n`).join('')}`,
  );
  const streams = new Set<ReadStream>();
  const read = ReadStream.prototype._read;
  t.mock.method(
    ReadStream.prototype,
    '_read',
    function (this: ReadStream, size: number) {
      if (String(this.path) === path.join(directory, 'stops.txt')) {
        streams.add(this);
      }
      read.call(this, size);
    },
  );
  const workingDirectories = new Set<string>();
  const prepare = Database.prototype.prepare;
  t.mock.method(
    Database.prototype,
    'prepare',
    function (this: Database.Database, sql: string) {
      if (path.basename(this.name) === 'records.sqlite') {
        workingDirectories.add(path.dirname(this.name));
      }
      return prepare.call(this, sql);
    },
  );
  const failure = new Error('Consumer failed');
  await assert.rejects(
    importGtfsSourceDirectly({
      options: {
        directory,
        tables: fileBackedTables,
        sourceId: 'source',
        mode: 'off',
        onUnknownField: 'preserve',
        onDuplicateKey: 'reject',
      },
      sink: {
        batchSize: 2,
        writeBatch() {
          throw failure;
        },
      },
    }),
    (error) => error === failure,
  );
  assert.equal(streams.size, 1);
  for (const stream of streams) {
    assert.equal(stream.destroyed, true);
  }
  assert.equal(workingDirectories.size, 1);
  for (const directory of workingDirectories) {
    await assert.rejects(stat(directory), { code: 'ENOENT' });
  }
});
