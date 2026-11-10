import assert from 'node:assert/strict';
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import {
  Gtfs,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  exportGtfs,
  importGtfs,
  type GtfsImportOptions,
} from '../../../src/index.ts';
import { gtfsManifest } from '../../../src/schema/index.ts';
import rows from '../../fixtures/complete-extensions/tods-v1.json' with { type: 'json' };
import { completeFixturePath } from '../../helpers/test-utils.ts';
export async function dropTodsTestTables<DB>(
  database: GtfsImportOptions<DB>['database'],
): Promise<void> {
  const gtfs = new Gtfs({ database, reporting: { level: 'silent' } });
  try {
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const table of Object.values(gtfsManifest)) {
          if (
            table.specification === 'tods' ||
            table.specification === 'tods-v1'
          ) {
            await db.schema.dropTable(table.tableName).ifExists().execute();
          }
        }
      },
    });
  } finally {
    await gtfs.close();
  }
}
export async function verifyTodsV1RoundTrip<DB>(
  database: GtfsImportOptions<DB>['database'],
): Promise<void> {
  await dropTodsTestTables(database);
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-tods-v1-'));
  const feedPath = path.join(directory, 'feed');
  const outputDirectory = path.join(directory, 'export');
  const gtfs = new Gtfs({
    database,
    extensions: ['tods-v1'],
    reporting: { level: 'silent' },
  });
  const current = new Gtfs({
    database,
    extensions: ['tods'],
    reporting: { level: 'silent' },
  });
  try {
    await cp(completeFixturePath, feedPath, { recursive: true });
    for (const [filename, records] of Object.entries(rows)) {
      await writeFile(
        path.join(feedPath, filename),
        stringify(records, { header: true }),
      );
    }
    const config = {
      database,
      extensions: ['tods-v1'] as const,
      reporting: { level: 'silent' as const },
    };
    for (const inputPath of [feedPath, outputDirectory]) {
      const result = await importGtfs({
        ...config,
        sources: [{ sourceId: 'tods-test', schedule: { path: inputPath } }],
      });
      assert.equal(result.success, true);
      assert.deepEqual(result.errors, []);
      assert.equal(
        result.validation.samples.some(
          (notice) =>
            notice.code === GtfsValidationNoticeCode.EXTENSION_DISABLED,
        ),
        false,
      );
      for (const [filename, records] of Object.entries(rows)) {
        const property = filename
          .replace('.txt', '')
          .replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
        const repository = (
          gtfs.todsV1 as unknown as Record<
            string,
            {
              select(...fields: string[]): { all(): PromiseLike<unknown[]> };
            }
          >
        )[property];
        assert.ok(repository);
        assert.deepEqual(
          await repository.select(...Object.keys(records[0] ?? {})).all(),
          records,
          filename,
        );
      }
      await exportGtfs({
        ...config,
        export: { outputDirectory, sourceId: 'tods-test', overwrite: true },
      });
      assert.deepEqual(
        (await readdir(outputDirectory))
          .filter((name) => Object.hasOwn(rows, name))
          .sort(),
        Object.keys(rows).sort(),
      );
      for (const [filename, records] of Object.entries(rows)) {
        const exported = parse(
          await readFile(path.join(outputDirectory, filename), 'utf8'),
          { columns: true, skip_empty_lines: true },
        );
        assert.deepEqual(
          exported,
          records.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, String(value)]),
            ),
          ),
        );
      }
    }
    const conflict = (error: unknown) => {
      const candidate = error as {
        code: string;
        details: {
          conflictingExtension: string;
          conflictingTables: string[];
        };
      };
      assert.equal(candidate.code, GtfsErrorCode.SCHEMA_INVALID);
      assert.equal(candidate.details.conflictingExtension, 'tods-v1');
      assert.deepEqual(candidate.details.conflictingTables.sort(), [
        'deadhead_times',
        'deadheads',
        'ops_locations',
        'run_event',
        'runs_pieces',
      ]);
      return true;
    };
    for (const operation of [
      () => current.schema.ensure(),
      () => current.schema.validate(),
      () => current.schema.recreate(),
      () => current.tods.runEvents.count(),
    ]) {
      await assert.rejects(
        async () => (typeof operation === 'function' ? operation() : operation),
        conflict,
      );
    }
    assert.equal(
      await gtfs.todsV1.runEvent.count(),
      rows['run_event.txt'].length,
    );
    await assert.rejects(async () => gtfs.tods.runEvents.all(), {
      code: GtfsErrorCode.EXTENSION_DISABLED,
    });
    await gtfs.close();
    await assert.rejects(async () => gtfs.todsV1.runEvent.count(), {
      code: GtfsErrorCode.INSTANCE_CLOSED,
    });
    await dropTodsTestTables(database);
    await current.schema.recreate();
    assert.deepEqual(await current.tods.runEvents.all(), []);
    const old = new Gtfs({
      database,
      extensions: ['tods-v1'],
      reporting: { level: 'silent' },
    });
    try {
      await assert.rejects(async () => old.schema.recreate(), {
        code: GtfsErrorCode.SCHEMA_INVALID,
      });
      assert.equal(await current.tods.runEvents.count(), 0);
    } finally {
      await old.close();
    }
  } finally {
    await gtfs.close();
    await current.close();
    await dropTodsTestTables(database);
    await rm(directory, { recursive: true, force: true });
  }
}
