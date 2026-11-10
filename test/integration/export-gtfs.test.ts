import { describe, it, before, after } from 'node:test';
import {
  countCsvRows,
  countFeedInventory,
  completeFixturePath,
  extractFixtureArchive,
  recreateFixtureDirectory,
} from '../helpers/test-utils.ts';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect, sql } from 'kysely';

import config from '../helpers/test-config.ts';
import {
  GtfsError,
  GtfsErrorCode,
  importGtfs,
  exportGtfs,
} from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';

const scheduleManifest = Object.fromEntries(
  Object.entries(gtfsManifest).filter(
    ([, definition]) => definition.specification === 'gtfs-schedule',
  ),
);

describe('exportGtfs():', () => {
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-export-test-'));
  const sourceDir = path.join(temporaryDir, 'source');
  const outputDirectory = path.join(temporaryDir, 'export');
  let sourceCounts: Record<string, number> = {};
  let sqlite: Database.Database;

  before(async () => {
    // Count the rows in the original feed so the export can be compared
    // against its true source rather than against the database it came from.
    await recreateFixtureDirectory(sourceDir);
    await extractFixtureArchive(config.sources[0].schedule.path, sourceDir);
    sourceCounts = await countFeedInventory(sourceDir, scheduleManifest);

    sqlite = new Database(':memory:');
    const database = { client: sqlite };
    await importGtfs({ ...config, database, extensions: [] });
    await exportGtfs({
      database,
      export: { outputDirectory },
      reporting: config.reporting,
    });
  });

  after(async () => {
    sqlite.close();
    await rm(temporaryDir, { recursive: true, force: true });
  });

  const tablesToValidate = Object.entries(scheduleManifest);

  it('should export exactly the files for tables that had rows', async () => {
    const expectedFilenames = tablesToValidate
      .flatMap(([tableName, definition]) =>
        (sourceCounts[tableName] ?? 0) > 0 && definition.filename !== null
          ? [definition.filename]
          : [],
      )
      .sort();
    const exportedFilenames = (await readdir(outputDirectory)).sort();

    assert.ok(expectedFilenames.length > 0);
    assert.deepEqual(exportedFilenames, expectedFilenames);
  });

  it('matches row counts for every expected exported file', async () => {
    const populatedTables = tablesToValidate.filter(
      ([name]) => (sourceCounts[name] ?? 0) > 0,
    );
    const exportedCounts = Object.fromEntries(
      await Promise.all(
        populatedTables.map(async ([name, definition]) => {
          assert.ok(definition.filename);
          return [
            name,
            await countCsvRows(path.join(outputDirectory, definition.filename)),
          ];
        }),
      ),
    );
    assert.deepEqual(
      exportedCounts,
      Object.fromEntries(
        populatedTables.map(([name]) => [name, sourceCounts[name]]),
      ),
    );
  });
});

it('exports through a caller-owned portable Kysely connection without leaking physical columns', async () => {
  const db = new Database(':memory:');
  const kysely = new Kysely({
    dialect: new SqliteDialect({ database: db }),
  });
  const temporaryDir = mkdtempSync(
    path.join(tmpdir(), 'gtfs-portable-export-'),
  );
  const outputDirectory = path.join(temporaryDir, 'export');

  try {
    await importGtfs({
      database: { client: db },
      sources: [
        {
          sourceId: 'portable',
          schedule: { path: completeFixturePath },
        },
      ],
      reporting: { level: 'silent' },
    });
    await exportGtfs({
      database: { client: kysely },
      export: {
        outputDirectory,
        sourceId: 'portable',
        batchSize: 1,
      },
      reporting: { level: 'silent' },
    });

    const stopTimes = await readFile(
      path.join(outputDirectory, 'stop_times.txt'),
      'utf8',
    );
    const header = stopTimes.split('\n')[0]!.split(',');
    assert.ok(header.includes('arrival_time'));
    assert.ok(!header.includes('source_id'));
    assert.ok(!header.includes('arrival_service_day_seconds'));
    assert.ok(!header.some((field) => field.startsWith('_node_gtfs')));

    const locations = JSON.parse(
      await readFile(path.join(outputDirectory, 'locations.geojson'), 'utf8'),
    ) as { type: string; features: unknown[] };
    assert.deepEqual(locations.type, 'FeatureCollection');
    assert.ok(locations.features.length > 0);

    const result = await sql<{
      count: number;
    }>`select count(*) as count from agency`.execute(kysely);
    assert.ok(Number(result.rows[0]!.count) > 0);
  } finally {
    await kysely.destroy();
    await rm(temporaryDir, { recursive: true, force: true });
  }
});

it('rejects schemas without source identity', async () => {
  const db = new Database(':memory:');
  const kysely = new Kysely({
    dialect: new SqliteDialect({ database: db }),
  });
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-schema-export-'));

  try {
    db.exec(
      "CREATE TABLE agency (agency_name TEXT NOT NULL); INSERT INTO agency VALUES ('Legacy');",
    );
    await assert.rejects(
      exportGtfs({
        database: { client: kysely },
        export: { outputDirectory: temporaryDir },
        reporting: { level: 'silent' },
      }),
      (error: unknown) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        const inspection = error.details?.schema as {
          tableIssues: { tableName: string; missingColumns: string[] }[];
        };
        assert.ok(
          inspection.tableIssues.some(
            (table) =>
              table.tableName === 'agency' &&
              table.missingColumns.includes('source_id'),
          ),
        );
        return true;
      },
    );
  } finally {
    await kysely.destroy();
    await rm(temporaryDir, { recursive: true, force: true });
  }
});

it('validates the portable export stream chunk size', async () => {
  const db = new Database(':memory:');
  const kysely = new Kysely({
    dialect: new SqliteDialect({ database: db }),
  });
  try {
    await assert.rejects(
      exportGtfs({
        database: { client: kysely },
        export: { batchSize: 0 },
        reporting: { level: 'silent' },
      }),
      /export\.batchSize.*positive safe integer/i,
    );
  } finally {
    await kysely.destroy();
  }
});

it('does not create a missing SQLite database during export', async () => {
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-missing-export-'));
  const databasePath = path.join(temporaryDir, 'missing.sqlite');
  try {
    await assert.rejects(
      exportGtfs({
        database: { path: databasePath },
        export: { outputDirectory: path.join(temporaryDir, 'export') },
      }),
      (error: unknown) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, GtfsErrorCode.DATABASE_NOT_FOUND);
        assert.equal(error.category, 'database');
        assert.deepEqual(error.details, {
          path: databasePath,
          operation: 'export',
        });
        return true;
      },
    );
    await assert.rejects(readFile(databasePath), { code: 'ENOENT' });
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
});

it('requires a source for multi-source export and emits original IDs', async () => {
  const db = new Database(':memory:');
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-source-export-'));
  const outputDirectory = path.join(temporaryDir, 'export');

  try {
    await importGtfs({
      database: { client: db },
      sources: [
        { sourceId: 'a', schedule: { path: completeFixturePath } },
        { sourceId: 'b', schedule: { path: completeFixturePath } },
      ],
      reporting: { level: 'silent' },
    });

    await assert.rejects(
      exportGtfs({
        database: { client: db },
        export: { outputDirectory },
        reporting: { level: 'silent' },
      }),
      /multiple GTFS sources.*export\.sourceId/i,
    );
    await assert.rejects(
      exportGtfs({
        database: { client: db },
        export: { outputDirectory, sourceId: 'missing' },
        reporting: { level: 'silent' },
      }),
      (error: unknown) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, GtfsErrorCode.DATABASE_SOURCE_NOT_FOUND);
        assert.equal(error.category, 'database');
        assert.equal(error.details?.sourceId, 'missing');
        return true;
      },
    );
    const result = await exportGtfs({
      database: { client: db },
      export: { outputDirectory, sourceId: 'a' },
      reporting: { level: 'silent' },
    });
    assert.equal(result.sourceId, 'a');
    assert.deepEqual(
      result.files.find((file) => file.filename === 'routes.txt'),
      { filename: 'routes.txt', recordCount: 2 },
    );

    const routes = await readFile(
      path.join(outputDirectory, 'routes.txt'),
      'utf8',
    );
    assert.ok(!routes.split('\n')[0]!.includes('source_id'));
    assert.match(routes, /FR1/);
    assert.ok(!/a[_:-]FR1/.test(routes));
  } finally {
    db.close();
    await rm(temporaryDir, { recursive: true, force: true });
  }
});
