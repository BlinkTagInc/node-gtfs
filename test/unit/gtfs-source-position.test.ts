import { createSourceFixtureFile } from '../helpers/source-fixture.ts';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { isGtfsError } from '../../src/diagnostics/errors.ts';
import { readGtfsCsvRecordBatches } from '../../src/schedule/import/csv.ts';
import { importGtfsSourceDirectly } from '../../src/schedule/import/process-source.ts';
import { collectStagedImportBatches } from '../helpers/import-batches.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { type GtfsSourcePosition } from '../../src/diagnostics/position.ts';
import { createKyselyGtfsWriter } from '../../src/database/kysely/schedule-writer.ts';
import { createSqliteGtfsWriter } from '../../src/database/sqlite/schedule-writer.ts';
import { applySqliteGtfsTablePlan } from '../../src/database/sqlite/schema-writer.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { getGtfsDialectCapabilities } from '../../src/database/dialects.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';

const agency = compiledTableRegistry.agency;
const header = 'agency_id,agency_name,agency_url,agency_timezone';
const agencyRow = (id: string, name = id) =>
  `${id},${name},https://example.com,America/Los_Angeles`;
const csvPosition = (
  recordNumber: number,
  csvLineNumber: number,
): GtfsSourcePosition => ({
  kind: 'csv',
  recordNumber,
  csvLineNumber,
});

function createWriter(
  t: TestContext,
  adapter: 'native' | 'kysely',
  table: FileBackedCompiledGtfsTable = agency,
) {
  const database = new Database(':memory:');
  const plan = createGtfsStoragePlan({ dialect: 'sqlite', tables: [table] });
  applySqliteGtfsTablePlan(database, plan);
  const options = {
    table,
    filename: table.filename,
    sourceId: 'test',
    onDuplicateKey: 'keep-first' as const,
    reporting: { level: 'silent' as const },
  };
  if (adapter === 'native') {
    t.after(() => database.close());
    return {
      database,
      plan,
      writer: createSqliteGtfsWriter({
        ...options,
        database,
        databasePath: ':memory:',
        storagePlan: plan,
      }),
    };
  }
  const kysely = new Kysely({ dialect: new SqliteDialect({ database }) });
  t.after(() => kysely.destroy());
  return {
    database,
    plan,
    writer: createKyselyGtfsWriter({
      ...options,
      database: kysely,
      storagePlan: plan,
    }),
  };
}

async function collect(
  filePath: string,
  table: FileBackedCompiledGtfsTable,
  batchSize: number,
) {
  return collectStagedImportBatches({
    directory: path.dirname(filePath),
    tables: [table],
    batchSize,
    sourceId: 'test',
    mode: 'permissive',
    onUnknownField: 'preserve',
  });
}

describe('GTFS source positions', () => {
  for (const newline of ['\n', '\r\n']) {
    it(`preserves CSV record and physical line numbers with ${JSON.stringify(newline)} delimiters`, async (t) => {
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: [
          '\uFEFF',
          header,
          '',
          'one,"Two',
          'lines",https://example.com,America/Los_Angeles',
          '',
          agencyRow('invalid', ''),
          agencyRow('two'),
          agencyRow('three'),
        ].join(newline),
      });
      const batches = await collect(filePath, agency, 1);
      assert.deepEqual(
        batches.map(({ totalRecordCount }) => totalRecordCount),
        [1, 3, 4],
      );
      assert.deepEqual(
        batches.flatMap(({ records }) =>
          records.map(({ position }) => position),
        ),
        [csvPosition(1, 5), csvPosition(3, 8), csvPosition(4, 9)],
      );
      for (const { records } of batches) {
        for (const { row, position } of records) {
          assert.equal(Object.isFrozen(position), true);
          assert.equal('position' in row, false);
          assert.equal('recordNumber' in row, false);
          assert.equal('csvLineNumber' in row, false);
        }
      }
      await assert.rejects(
        importGtfsSourceDirectly({
          options: {
            directory: path.dirname(filePath),
            tables: [agency],
            sourceId: 'test',
            mode: 'off',
            onUnknownField: 'preserve',
            onDuplicateKey: 'reject',
          },
          sink: {
            batchSize: 1,
            writeBatch(batch) {
              assert.equal(batch.records.length, 1);
            },
          },
        }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.deepEqual(error.position, csvPosition(2, 7));
          assert.match(error.message, /CSV record 2 \(ending at line 7\)/);
          assert.equal(error.details?.row, undefined);
          return true;
        },
      );
    });
  }

  it('captures per-record snapshots even when the CSV parser reads ahead', async (t) => {
    const { filePath } = await createSourceFixtureFile(t, {
      filename: 'agency.txt',
      contents: [header, agencyRow('one'), '', agencyRow('two')].join('\n'),
    });
    const positions = [];
    for await (const batch of readGtfsCsvRecordBatches(filePath, {})) {
      for (const { position } of batch) {
        positions.push(position);
      }
    }
    assert.deepEqual(positions, [csvPosition(1, 2), csvPosition(2, 4)]);
  });

  it('preserves string identifiers and empty cells without skipping records', async (t) => {
    const { filePath } = await createSourceFixtureFile(t, {
      filename: 'agency.txt',
      contents: [
        header,
        agencyRow('001'),
        agencyRow('002', ''),
        agencyRow('003'),
      ].join('\n'),
    });
    const positions = [];
    const values: unknown[] = [];
    for await (const batch of readGtfsCsvRecordBatches(filePath, {})) {
      for (const { record, position } of batch) {
        values.push([record.agency_id, record.agency_name]);
        positions.push(position);
      }
    }
    assert.deepEqual(values, [
      ['001', '001'],
      ['002', ''],
      ['003', '003'],
    ]);
    assert.deepEqual(positions, [
      csvPosition(1, 2),
      csvPosition(2, 3),
      csvPosition(3, 4),
    ]);
  });

  for (const encoding of ['utf8', 'utf16le'] as const) {
    it(`tracks physical lines across read chunks for ${encoding}`, async (t) => {
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: '',
      });
      const prefix = '\uFEFFid,name\r\n1,"';
      // Place a quoted CRLF across the ReadStream's 64 KiB chunk boundary.
      const padding =
        (65_536 - Buffer.byteLength(prefix, encoding)) /
          (encoding === 'utf16le' ? 2 : 1) -
        1;
      const contents = `${prefix}${'x'.repeat(padding)}\r\ny"\r\n2,last`;
      await writeFile(filePath, contents, encoding);
      const positions = [];
      for await (const batch of readGtfsCsvRecordBatches(filePath, {})) {
        for (const { record, position } of batch) {
          assert.ok(record.id === '1' || record.id === '2');
          positions.push(position);
        }
      }
      assert.deepEqual(positions, [csvPosition(1, 3), csvPosition(2, 4)]);
    });
  }

  for (const adapter of ['native', 'kysely'] as const) {
    it(`${adapter} SQLite writer retains positions through later batches and duplicate filtering`, async (t) => {
      const { writer, database } = createWriter(t, adapter);
      database.exec(
        "CREATE TRIGGER reject_agency BEFORE INSERT ON agency WHEN NEW.agency_id = 'fail' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      );
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: [
          header,
          agencyRow('one'),
          agencyRow('two'),
          agencyRow('invalid', ''),
          agencyRow('one'),
          '',
          agencyRow('fail'),
        ].join('\n'),
      });
      const batches = await collect(filePath, agency, 2);
      const [first, second] = batches;
      assert.ok(first);
      assert.ok(second);
      assert.deepEqual(
        second.records.map(({ position }) => position),
        [csvPosition(4, 5), csvPosition(5, 7)],
      );
      await writer.writeBatch(first);
      await assert.rejects(
        async () => writer.writeBatch(second),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
          assert.equal(error.details?.filename, 'agency.txt');
          if (adapter === 'native') {
            assert.deepEqual(error.position, csvPosition(5, 7));
            assert.match(error.message, /CSV record 5 \(ending at line 7\)/);
          } else {
            assert.deepEqual(error.positions, [
              csvPosition(4, 5),
              csvPosition(5, 7),
            ]);
            assert.equal(error.position, undefined);
          }
          assert.equal(error.details?.row, undefined);
          return true;
        },
      );
      assert.deepEqual(
        database
          .prepare('SELECT agency_id FROM agency ORDER BY agency_id')
          .all(),
        [{ agency_id: 'one' }, { agency_id: 'two' }],
      );
    });

    it(`${adapter} SQLite writer reports GeoJSON feature numbers without CSV offsets`, async (t) => {
      const { writer, database } = createWriter(
        t,
        adapter,
        compiledTableRegistry.locations,
      );
      database.exec(
        "CREATE TRIGGER reject_location BEFORE INSERT ON locations WHEN NEW.id = 'fail' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      );
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      };
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'locations.geojson',
        contents: JSON.stringify({
          type: 'FeatureCollection',
          features: ['one', 'fail'].map((id) => ({
            type: 'Feature',
            id,
            properties: {},
            geometry,
          })),
        }),
      });
      const [first, second] = await collect(
        filePath,
        compiledTableRegistry.locations,
        1,
      );
      assert.ok(first);
      assert.ok(second);
      await writer.writeBatch(first);
      const position: GtfsSourcePosition = {
        kind: 'geojson',
        featureNumber: 2,
      };
      assert.deepEqual(second.records[0]?.position, position);
      await assert.rejects(
        async () => writer.writeBatch(second),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.deepEqual(
            adapter === 'native' ? error.position : error.positions,
            adapter === 'native' ? position : [position],
          );
          if (adapter === 'native') {
            assert.match(error.message, /locations.geojson feature 2/);
          }
          return true;
        },
      );
      assert.throws(
        () =>
          normalizeGtfsRecord({ geometry }, compiledTableRegistry.locations, {
            sourceId: 'test',
            position,
          }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.deepEqual(error.position, position);
          assert.match(error.message, /at feature 2/);
          return true;
        },
      );
    });
  }

  it('reports only positions in the failed Kysely insert chunk, without guessing the failed row', async (t) => {
    const { writer, database, plan } = createWriter(t, 'kysely');
    const tablePlan = plan.tables[0];
    assert.ok(tablePlan);
    const capabilities = getGtfsDialectCapabilities('sqlite');
    const chunkSize = Math.min(
      capabilities.maximumRowsPerInsert,
      Math.floor(
        capabilities.maximumParametersPerInsert / tablePlan.columns.length,
      ),
    );
    const input = Array.from({ length: chunkSize + 2 }, (_, index) =>
      agencyRow(String(index), index === chunkSize ? 'FAIL' : 'Agency'),
    );
    database.exec(
      "CREATE TRIGGER reject_agency BEFORE INSERT ON agency WHEN NEW.agency_name = 'FAIL' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    const { filePath } = await createSourceFixtureFile(t, {
      filename: 'agency.txt',
      contents: [header, ...input].join('\n'),
    });
    const [batch] = await collect(filePath, agency, input.length);
    assert.ok(batch);
    await assert.rejects(
      async () => writer.writeBatch(batch),
      (error) => {
        assert.ok(isGtfsError(error));
        assert.deepEqual(error.positions, [
          csvPosition(chunkSize + 1, chunkSize + 2),
          csvPosition(chunkSize + 2, chunkSize + 3),
        ]);
        assert.equal(error.position, undefined);
        assert.match(error.message, /insert containing 2 source records/);
        return true;
      },
    );
  });
});
