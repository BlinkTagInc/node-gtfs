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
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import {
  Gtfs,
  GtfsValidationNoticeCode,
  exportGtfs,
  importGtfs,
  type GtfsExtension,
  type GtfsImportOptions,
  type GtfsImportResult,
} from '../../../src/index.ts';
import { gtfsManifest } from '../../../src/schema/index.ts';
import fixture from '../../fixtures/complete-extensions/rows.json' with { type: 'json' };
import { completeFixturePath } from '../../helpers/test-utils.ts';
import { recreateTestSchema } from '../../helpers/recreate-schema.ts';
export const extensionGroups = {
  'gtfs-plus': 'gtfsPlus',
  'gtfs-ride': 'gtfsRide',
  'gtfs-to-html': 'gtfsToHtml',
  tods: 'tods',
  tides: 'tides',
} as const;
type ScheduleExtension = keyof typeof extensionGroups;
export const extensions = Object.keys(extensionGroups) as ScheduleExtension[];
type FixtureRow = Readonly<Record<string, string | number>>;
export const rowsByFilename: Readonly<Record<string, readonly FixtureRow[]>> =
  fixture;
export function extensionTables(extension: ScheduleExtension) {
  return Object.values(gtfsManifest).filter(
    (table) => table.specification === extension,
  );
}
export function expectedRows(filename: string): readonly FixtureRow[] {
  const rows = rowsByFilename[filename];
  assert.ok(rows, `Missing fixture for ${filename}`);
  assert.ok(rows.length > 0, `Empty fixture for ${filename}`);
  return rows;
}
export async function writeExtensionFeed(
  directory: string,
  extension: ScheduleExtension,
): Promise<void> {
  await cp(completeFixturePath, directory, { recursive: true });
  for (const table of extensionTables(extension)) {
    assert.ok(table.filename);
    await writeFile(
      path.join(directory, table.filename),
      stringify([...expectedRows(table.filename)], {
        header: true,
        columns: Object.keys(table.fields),
      }),
    );
  }
}
export function assertCreatedTables(
  database: Database.Database,
  enabledExtensions: readonly GtfsExtension[],
): void {
  const expected = Object.entries(gtfsManifest)
    .filter(
      ([, table]) =>
        table.specification === 'gtfs-schedule' ||
        enabledExtensions.includes(table.specification as GtfsExtension),
    )
    .map(([name]) => name)
    .sort();
  assert.deepEqual(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_node_gtfs_*' ORDER BY name",
      )
      .pluck()
      .all(),
    expected,
  );
}
export async function assertPublicRows({
  database,
  extension,
  sourceId,
  enabledExtensions,
}: {
  database: Database.Database;
  extension: ScheduleExtension;
  sourceId: string;
  enabledExtensions: readonly GtfsExtension[];
}): Promise<void> {
  return assertConnectionPublicRows({
    database: { client: database },
    extension,
    sourceId,
    enabledExtensions,
  });
}
async function assertConnectionPublicRows<DB>({
  database,
  extension,
  sourceId,
  enabledExtensions,
}: {
  database: GtfsImportOptions<DB>['database'];
  extension: ScheduleExtension;
  sourceId: string;
  enabledExtensions: readonly GtfsExtension[];
}): Promise<void> {
  const gtfs = new Gtfs({
    database,
    extensions: enabledExtensions,
    sources: [{ sourceId }],
    reporting: { level: 'silent' },
  });
  try {
    const repositories = gtfs[extensionGroups[extension]] as unknown as Record<
      string,
      {
        select(...fields: string[]): { all(): PromiseLike<unknown[]> };
      }
    >;
    for (const table of extensionTables(extension)) {
      assert.ok(table.filename);
      const property = table.filename
        .replace(/\.(txt|csv)$/u, '')
        .replace(/_([a-z])/gu, (_match, letter: string) =>
          letter.toUpperCase(),
        );
      const repository = repositories[property];
      assert.ok(repository, `Missing repository ${extension}.${property}`);
      assert.deepEqual(
        await repository
          .select('source_id', ...Object.keys(table.fields))
          .all(),
        expectedRows(table.filename).map((row) => ({
          source_id: sourceId,
          ...row,
        })),
        `${sourceId}: public values for ${table.filename}`,
      );
    }
  } finally {
    await gtfs.close();
  }
}
export async function verifyPortableExtensionRoundTrips<DB>(
  database: GtfsImportOptions<DB>['database'],
): Promise<void> {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-portable-extensions-'),
  );
  try {
    await recreateTestSchema({ database, extensions });
    const sources = [];
    for (const extension of extensions) {
      const feedPath = path.join(directory, extension);
      await writeExtensionFeed(feedPath, extension);
      sources.push({ sourceId: extension, schedule: { path: feedPath } });
    }
    for (const selection of ['auto', extensions] as const) {
      const imported: GtfsImportResult = await importGtfs({
        database,
        sources,
        extensions: selection,
        reporting: { level: 'silent' },
      });
      assert.equal(imported.success, true);
      const exportedSources = [];
      for (const extension of extensions) {
        await assertConnectionPublicRows({
          database,
          extension,
          sourceId: extension,
          enabledExtensions: extensions,
        });
        const outputDirectory = path.join(directory, `export-${extension}`);
        await exportGtfs({
          database,
          extensions,
          export: {
            outputDirectory,
            sourceId: extension,
            batchSize: 1,
            overwrite: true,
          },
          reporting: { level: 'silent' },
        });
        await assertExportedFiles(outputDirectory, extension);
        exportedSources.push({
          sourceId: extension,
          schedule: { path: outputDirectory },
        });
      }
      const reimported: GtfsImportResult = await importGtfs({
        database,
        sources: exportedSources,
        extensions: selection,
        reporting: { level: 'silent' },
      });
      assert.equal(reimported.success, true);
      for (const extension of extensions) {
        await assertConnectionPublicRows({
          database,
          extension,
          sourceId: extension,
          enabledExtensions: extensions,
        });
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export async function assertExportedFiles(
  outputDirectory: string,
  extension: ScheduleExtension,
): Promise<void> {
  const scheduleFilenames = Object.values(gtfsManifest)
    .filter((table) => table.specification === 'gtfs-schedule')
    .map((table) => table.filename);
  const expectedFilenames = [
    ...(await readdir(completeFixturePath)).filter((filename) =>
      scheduleFilenames.includes(filename),
    ),
    ...extensionTables(extension).map((table) => table.filename),
  ].sort();
  assert.deepEqual((await readdir(outputDirectory)).sort(), expectedFilenames);
  for (const table of extensionTables(extension)) {
    assert.ok(table.filename);
    const exported = parse(
      await readFile(path.join(outputDirectory, table.filename), 'utf8'),
      { columns: true, skip_empty_lines: true },
    ) as Record<string, string>[];
    const expected = expectedRows(table.filename).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([field, value]) => [field, String(value)]),
      ),
    );
    assert.deepEqual(
      exported,
      expected,
      `Exported values for ${table.filename}`,
    );
  }
}
export async function importFeeds(
  database: Database.Database,
  sources: readonly {
    sourceId: string;
    schedule: {
      path: string;
    };
  }[],
  selection: readonly GtfsExtension[] | 'auto',
): Promise<void> {
  const result = await importGtfs({
    database: { client: database },
    sources,
    extensions: selection,
    reporting: { level: 'silent' },
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.validation.samples.filter(
      (notice) =>
        notice.severity === 'error' ||
        notice.code === GtfsValidationNoticeCode.EXTENSION_DISABLED,
    ),
    [],
  );
}
