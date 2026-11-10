import { createSourceFixtureFile } from '../helpers/source-fixture.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import type { NormalizedImportRowBatch } from '../../src/schedule/import/records.ts';
import { readGtfsSourceRecordBatches } from '../../src/schedule/import/read-source.ts';
import { importGtfsSourceDirectly } from '../../src/schedule/import/process-source.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';
import { collectStagedImportBatches } from '../helpers/import-batches.ts';

const agencyHeader =
  'agency_id,agency_name,agency_url,agency_timezone,cemv_support';

function agencyRow(id: string, name = id, cemvSupport = '0'): string {
  return `${id},${name},https://${id}.example,America/Los_Angeles,${cemvSupport}`;
}

async function readSourceFile(
  filePath: string,
  table: FileBackedCompiledGtfsTable = compiledTableRegistry.agency,
) {
  let headers: readonly string[] = [];
  const records = [];
  for await (const batch of readGtfsSourceRecordBatches({
    filePath,
    table,
    csv: {},
    onHeaders(value) {
      headers = value;
    },
  })) {
    records.push(...batch);
  }
  return { headers, records };
}

for (const delivery of ['direct', 'staged'] as const) {
  async function collectBatches(
    directory: string,
    table: FileBackedCompiledGtfsTable = compiledTableRegistry.agency,
    batchSize = 2,
  ): Promise<NormalizedImportRowBatch[]> {
    const options = {
      directory,
      tables: [table],
      sourceId: 'test',
      mode: 'off' as const,
      onUnknownField: 'preserve' as const,
      onDuplicateKey: 'reject' as const,
    };
    if (delivery === 'staged') {
      return collectStagedImportBatches({ ...options, batchSize });
    }
    const batches: NormalizedImportRowBatch[] = [];
    await importGtfsSourceDirectly({
      options,
      sink: {
        batchSize,
        writeBatch(batch) {
          batches.push(batch);
        },
      },
    });
    return batches;
  }

  describe(`${delivery} source scanning`, () => {
    for (const scenario of [
      {
        name: 'exact batches',
        ids: ['one', 'two', 'three', 'four'],
        batchSize: 2,
        sizes: [2, 2],
        counts: [2, 4],
      },
      {
        name: 'partial final batch',
        ids: ['one', 'two', 'three'],
        batchSize: 2,
        sizes: [2, 1],
        counts: [2, 3],
      },
      {
        name: 'batch size one',
        ids: ['one', 'two'],
        batchSize: 1,
        sizes: [1, 1],
        counts: [1, 2],
      },
      {
        name: 'header-only file',
        ids: [],
        batchSize: 2,
        sizes: [],
        counts: [],
      },
    ]) {
      it(`preserves records and positions for ${scenario.name}`, async (t) => {
        const { directory } = await createSourceFixtureFile(t, {
          filename: 'agency.txt',
          contents: [
            agencyHeader,
            ...scenario.ids.map((id) => agencyRow(id)),
          ].join('\n'),
        });
        const batches = await collectBatches(
          directory,
          compiledTableRegistry.agency,
          scenario.batchSize,
        );
        assert.deepEqual(
          batches.map(({ records }) => records.length),
          scenario.sizes,
        );
        assert.deepEqual(
          batches.map(({ totalRecordCount }) => totalRecordCount),
          scenario.counts,
        );
        assert.deepEqual(
          batches.flatMap(({ records }) =>
            records.map(({ row, position }) => ({
              id: row.agency_id,
              position,
            })),
          ),
          scenario.ids.map((id, index) => ({
            id,
            position: {
              kind: 'csv',
              recordNumber: index + 1,
              csvLineNumber: index + 2,
            },
          })),
        );
      });
    }

    it('returns no batches for an empty file', async (t) => {
      const { directory } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: '',
      });
      assert.deepEqual(await collectBatches(directory), []);
    });

    it('rejects unrepresentable rows with their source positions', async (t) => {
      const { directory } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: [
          agencyHeader,
          agencyRow('one'),
          agencyRow('invalid', '', 'not-an-integer'),
          agencyRow('three'),
        ].join('\n'),
      });
      await assert.rejects(collectBatches(directory), (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.REQUIRED_VALUE_MISSING);
        assert.deepEqual(error.position, {
          kind: 'csv',
          recordNumber: 2,
          csvLineNumber: 3,
        });
        return true;
      });
    });

    it('propagates malformed CSV through the source scanner', async (t) => {
      const { directory } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: 'agency_id,agency_name\nagency-1,"unterminated\n',
      });
      await assert.rejects(collectBatches(directory), (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.CSV_PARSE_FAILED);
        assert.equal(error.details?.filename, 'agency.txt');
        assert.ok(error.cause instanceof Error);
        assert.equal(
          (error.cause as Error & { code?: string }).code,
          'CSV_QUOTE_NOT_CLOSED',
        );
        return true;
      });
    });

    it('batches locations.geojson features and serializes geometry', async (t) => {
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
      const ids = ['one', 'two', 'three'];
      const { directory } = await createSourceFixtureFile(t, {
        filename: 'locations.geojson',
        contents: JSON.stringify({
          type: 'FeatureCollection',
          features: ids.map((id) => ({
            type: 'Feature',
            id,
            properties: { stop_name: id },
            geometry,
          })),
        }),
      });
      const batches = await collectBatches(
        directory,
        compiledTableRegistry.locations,
      );
      assert.deepEqual(
        batches.map(({ records }) => records.length),
        [2, 1],
      );
      assert.deepEqual(
        batches.map(({ totalRecordCount }) => totalRecordCount),
        [2, 3],
      );
      assert.deepEqual(
        batches.flatMap(({ records }) =>
          records.map(({ row, position }) => ({
            id: row.id,
            geometry: JSON.parse(String(row.geometry)),
            position,
          })),
        ),
        ids.map((id, index) => ({
          id,
          geometry,
          position: { kind: 'geojson', featureNumber: index + 1 },
        })),
      );
    });
  });
}

it('permissive staging skips an invalid row without renumbering later records', async (t) => {
  const { directory } = await createSourceFixtureFile(t, {
    filename: 'agency.txt',
    contents: [
      agencyHeader,
      agencyRow('one'),
      agencyRow('invalid', '', 'not-an-integer'),
      agencyRow('three'),
    ].join('\n'),
  });
  const batches = await collectStagedImportBatches({
    directory,
    tables: [compiledTableRegistry.agency],
    sourceId: 'test',
    mode: 'permissive',
    onUnknownField: 'preserve',
    batchSize: 2,
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0]?.totalRecordCount, 3);
  assert.deepEqual(
    batches[0]?.records.map(({ row, position }) => ({
      id: row.agency_id,
      position,
    })),
    [
      {
        id: 'one',
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
      },
      {
        id: 'three',
        position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
      },
    ],
  );
});

describe('source reader error boundaries', () => {
  it(
    'wraps missing-file and directory read failures without uncaught stream errors',
    { timeout: 5_000 },
    async (t) => {
      const { directory } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: '',
      });
      for (const [filePath, causeCode] of [
        [path.join(directory, 'missing.txt'), 'ENOENT'],
        [directory, 'EISDIR'],
      ] as const) {
        await assert.rejects(readSourceFile(filePath), (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.CSV_PARSE_FAILED);
          assert.equal(error.category, 'parse');
          assert.deepEqual(error.details, { filename: 'agency.txt' });
          assert.ok(error.cause instanceof Error);
          assert.equal((error.cause as NodeJS.ErrnoException).code, causeCode);
          return true;
        });
      }
    },
  );

  it('retains headers for header-only files and no headers for empty files', async (t) => {
    for (const contents of ['', agencyHeader]) {
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: contents,
      });
      assert.deepEqual(await readSourceFile(filePath), {
        headers: contents ? agencyHeader.split(',') : [],
        records: [],
      });
    }
  });

  it('reports malformed CSV as GTFS_CSV_PARSE_FAILED', async (t) => {
    for (const malformedRecord of [
      'agency-1,"unterminated\n',
      'agency-1\n',
      'agency-1,Agency,extra\n',
    ]) {
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'agency.txt',
        contents: `agency_id,agency_name\n${malformedRecord}`,
      });
      await assert.rejects(readSourceFile(filePath), (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.CSV_PARSE_FAILED);
        assert.equal(error.details?.filename, 'agency.txt');
        return true;
      });
    }
  });

  it('reports unsupported table file types as GTFS_UNSUPPORTED_FILE_TYPE', async () => {
    const table = {
      ...compiledTableRegistry.agency,
      tableName: 'custom',
      filename: 'custom.yaml',
    };
    await assert.rejects(
      readSourceFile('/unused/custom.yaml', table),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.UNSUPPORTED_FILE_TYPE);
        assert.equal(error.category, 'parse');
        assert.deepEqual(error.details, {
          filename: 'custom.yaml',
          extension: 'yaml',
        });
        return true;
      },
    );
  });
});
