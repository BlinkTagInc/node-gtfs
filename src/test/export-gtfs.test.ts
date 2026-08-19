import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
  countCsvRows,
  countGtfsRows,
} from './test-utils.ts';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  exportGtfs,
  unzip,
  prepDirectory,
} from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';

describe('exportGtfs():', () => {
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-export-test-'));
  const sourceDir = path.join(temporaryDir, 'source');
  const exportPath = path.join(temporaryDir, 'export');
  let sourceCounts: Record<string, number> = {};

  beforeAll(async () => {
    // Count the rows in the original feed so the export can be compared
    // against its true source rather than against the database it came from.
    await prepDirectory(sourceDir);
    await unzip(config.agencies[0].path, sourceDir);
    sourceCounts = await countGtfsRows(sourceDir);

    openDb();
    await importGtfs(config);
    await exportGtfs({ ...config, exportPath });
  });

  afterAll(async () => {
    closeDb(openDb());
    await rm(temporaryDir, { recursive: true, force: true });
  });

  it('should export a file for every table that had rows', async () => {
    const populatedTables = Object.entries(gtfsManifest)
      .filter(([, definition]) => definition.file !== null)
      .filter(([tableName]) => sourceCounts[tableName] > 0)
      .map(([tableName]) => tableName);

    // Guards against the counts silently being empty, which would make every
    // per-table assertion below vacuous.
    expect(populatedTables.length).toBeGreaterThan(0);
  });

  const tablesToValidate = Object.entries(gtfsManifest).filter(
    ([, definition]) =>
      definition.namespace !== 'gtfs-realtime' && definition.file !== null,
  );

  for (const [tableName, definition] of tablesToValidate) {
    it(`should export the same number of ${tableName}`, async () => {
      const exportedCount = await countCsvRows(
        path.join(exportPath, definition.file as string),
      );

      expect(exportedCount).toEqual(sourceCounts[tableName]);
    });
  }
});
