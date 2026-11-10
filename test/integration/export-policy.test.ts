import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { Kysely, SqliteDialect } from 'kysely';

import {
  exportGtfs,
  importGtfs,
  GtfsErrorCode,
  isGtfsError,
  type GtfsExtension,
  type GtfsReportEvent,
  type GtfsExportResult,
} from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';
import { createFeedFixture } from '../helpers/test-utils.ts';

const execFileAsync = promisify(execFile);
const publicEntryUrl = new URL('../../src/index.ts', import.meta.url).href;
const scheduleFilenames = Object.values(gtfsManifest)
  .filter((table) => table.specification === 'gtfs-schedule')
  .map((table) => table.filename)
  .sort();

async function prepareExportFixture(
  t: TestContext,
  options: {
    extensions?: boolean;
    fileBacked?: boolean;
    agencyName?: string;
    sourceId?: string;
  } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-export-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'gtfs.sqlite');
  const sqlite = new Database(options.fileBacked ? filename : ':memory:');
  t.after(() => {
    if (sqlite.open) {
      sqlite.close();
    }
  });
  const feed = await createFeedFixture({
    base: 'complete',
    extraFiles: options.extensions
      ? {
          'directions.txt': 'route_id,direction_id,direction\nFR1,0,Outbound\n',
          'vehicles.csv': 'vehicle_id,model_name\nbus-1,Electric bus\n',
        }
      : {},
  });
  try {
    if (options.agencyName !== undefined) {
      const agencyPath = path.join(feed.path, 'agency.txt');
      const agency = await readFile(agencyPath, 'utf8');
      await writeFile(
        agencyPath,
        agency.replace(
          'Complete Transit',
          `"${options.agencyName.replaceAll('"', '""')}"`,
        ),
      );
    }
    const result = await importGtfs({
      database: { client: sqlite },
      sources: [
        { sourceId: options.sourceId ?? 'test', schedule: { path: feed.path } },
      ],
      extensions: 'auto',
      reporting: { level: 'silent' },
    });
    assert.equal(result.success, true);
  } finally {
    await feed.cleanup();
  }
  return { directory, filename, sqlite };
}

async function exportDefaultSource(options: {
  directory: string;
  filename: string;
  sourceId?: string;
  instance?: boolean;
  overwrite?: boolean;
}): Promise<GtfsExportResult> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        const { Gtfs, exportGtfs } = await import(process.argv[1]);
        const options = {
          database: { path: process.argv[2] },
          reporting: { level: 'silent' },
          export: {
            ...(process.argv[3] ? { sourceId: process.argv[3] } : {}),
            overwrite: process.argv[5] === 'true',
          },
        };
        let result;
        if (process.argv[4] === 'instance') {
          const gtfs = new Gtfs(options);
          try {
            result = await gtfs.export();
          } finally {
            await gtfs.close();
          }
        } else {
          result = await exportGtfs(options);
        }
        process.stdout.write(JSON.stringify(result));
      `,
      publicEntryUrl,
      options.filename,
      options.sourceId ?? '',
      options.instance ? 'instance' : 'standalone',
      String(options.overwrite ?? false),
    ],
    { cwd: options.directory, timeout: 30_000 },
  );
  return JSON.parse(stdout) as GtfsExportResult;
}

for (const adapter of ['native SQLite', 'Kysely SQLite'] as const) {
  test(`${adapter}: exports only explicitly enabled extension files from a populated database`, async (t) => {
    const { directory, sqlite } = await prepareExportFixture(t, {
      extensions: true,
    });
    const portable = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    t.after(() => portable.destroy());
    const client = adapter === 'native SQLite' ? sqlite : portable;
    const cases: readonly {
      extensions?: readonly GtfsExtension[];
      filenames: readonly string[];
    }[] = [
      { filenames: [] },
      { extensions: ['gtfs-plus'], filenames: ['directions.txt'] },
      { extensions: ['tides'], filenames: ['vehicles.csv'] },
      {
        extensions: ['gtfs-plus', 'tides'],
        filenames: ['directions.txt', 'vehicles.csv'],
      },
    ];

    for (const [index, selection] of cases.entries()) {
      const outputDirectory = path.join(directory, `export-${index}`);
      const result = await exportGtfs({
        database: { client },
        ...(selection.extensions === undefined
          ? {}
          : { extensions: selection.extensions }),
        export: { outputDirectory },
        reporting: { level: 'silent' },
      });
      assert.deepEqual(
        (await readdir(outputDirectory)).sort(),
        [...scheduleFilenames, ...selection.filenames].sort(),
      );
      assert.equal(result.sourceId, 'test');
      assert.equal(result.outputDirectory, outputDirectory);
      assert.deepEqual(
        result.files.map(({ filename }) => filename).sort(),
        [...scheduleFilenames, ...selection.filenames].sort(),
      );
      for (const filename of selection.filenames) {
        const rows = parse(
          await readFile(path.join(outputDirectory, filename), 'utf8'),
          {
            columns: true,
            skip_empty_lines: true,
          },
        );
        assert.equal(rows.length, 1, filename);
        assert.equal(
          result.files.find((file) => file.filename === filename)?.recordCount,
          rows.length,
        );
      }
    }
    assert.equal(
      sqlite.prepare('SELECT COUNT(*) FROM directions').pluck().get(),
      1,
    );
    assert.equal(
      sqlite.prepare('SELECT COUNT(*) FROM vehicles').pluck().get(),
      1,
    );
  });

  test(`${adapter}: exports successfully when every disabled extension table is absent`, async (t) => {
    const { directory, sqlite } = await prepareExportFixture(t);
    const portable = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    t.after(() => portable.destroy());
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_node_gtfs_*'",
      )
      .pluck()
      .all();
    assert.deepEqual(
      tables.sort(),
      Object.entries(gtfsManifest)
        .filter(([, table]) => table.specification === 'gtfs-schedule')
        .map(([name]) => name)
        .sort(),
    );
    const outputDirectory = path.join(directory, 'export');
    await exportGtfs({
      database: {
        client: adapter === 'native SQLite' ? sqlite : portable,
      },
      export: { outputDirectory },
      reporting: { level: 'silent' },
    });
    assert.deepEqual(
      (await readdir(outputDirectory)).sort(),
      scheduleFilenames,
    );
  });

  test(`${adapter}: missing enabled tables reject before replacing existing output`, async (t) => {
    const { directory, sqlite } = await prepareExportFixture(t, {
      extensions: true,
    });
    const portable = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    t.after(() => portable.destroy());
    const outputDirectory = path.join(directory, 'export');
    await mkdir(outputDirectory);
    await writeFile(
      path.join(outputDirectory, 'previous.txt'),
      'Previous successful export',
    );
    for (const [table, extension] of [
      ['directions', 'gtfs-plus'],
      ['vehicles', 'tides'],
    ] as const) {
      sqlite.exec(`DROP TABLE ${table}`);
      await assert.rejects(
        exportGtfs({
          database: {
            client: adapter === 'native SQLite' ? sqlite : portable,
          },
          extensions: [extension],
          export: { outputDirectory },
          reporting: { level: 'silent' },
        }),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
          const inspection = error.details?.schema as {
            tableIssues: { tableName: string; missingTable: boolean }[];
          };
          assert.ok(
            inspection.tableIssues.some(
              (issue: { tableName: string; missingTable: boolean }) =>
                issue.tableName === table && issue.missingTable,
            ),
          );
          return true;
        },
      );
      assert.deepEqual(await readdir(outputDirectory), ['previous.txt']);
      assert.equal(
        await readFile(path.join(outputDirectory, 'previous.txt'), 'utf8'),
        'Previous successful export',
      );
    }
  });
}

test('explicit overwrite removes stale files and directories while preserving neighboring output', async (t) => {
  const { directory, sqlite } = await prepareExportFixture(t);
  const outputDirectory = path.join(directory, 'export');
  await mkdir(path.join(outputDirectory, 'old-subdirectory'), {
    recursive: true,
  });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, 'old-subdirectory', 'previous.txt'),
      'stale',
    ),
    writeFile(path.join(outputDirectory, 'routes.txt'), 'obsolete routes'),
    writeFile(
      path.join(outputDirectory, 'vehicles.csv'),
      'obsolete disabled extension',
    ),
    writeFile(path.join(directory, 'neighbor.txt'), 'keep me'),
  ]);
  const events: GtfsReportEvent[] = [];
  await exportGtfs({
    database: { client: sqlite },
    export: { outputDirectory, overwrite: true },
    reporting: { reporter: (event) => events.push(event) },
  });
  assert.deepEqual((await readdir(outputDirectory)).sort(), scheduleFilenames);
  const routes = parse(
    await readFile(path.join(outputDirectory, 'routes.txt'), 'utf8'),
    { columns: true, skip_empty_lines: true },
  ) as { route_id: string }[];
  assert.deepEqual(routes.map((row) => row.route_id).sort(), ['FR1', 'FR2']);
  assert.equal(
    await readFile(path.join(directory, 'neighbor.txt'), 'utf8'),
    'keep me',
  );
  assert.deepEqual(
    events.filter((event) => event.level === 'warn'),
    [],
  );
});

for (const [agencyName, folderPrefix] of [
  ['Complete Transit', 'complete_transit'],
  ['North / South: "Café" Transit?', 'north_south_cafe_transit'],
  ['///', 'feed'],
  ['..', 'feed'],
  ['CON', 'feed'],
  ['東京都交通局'.repeat(20), '東京都交通局'.repeat(20).slice(0, 48)],
] as const) {
  test(`default export safely contains agency name ${JSON.stringify(agencyName)}`, async (t) => {
    const { directory, filename, sqlite } = await prepareExportFixture(t, {
      fileBacked: true,
      agencyName,
    });
    sqlite.close();
    const exportRoot = path.join(directory, 'gtfs-export');
    await mkdir(path.join(exportRoot, 'other-source'), { recursive: true });
    const sentinel = path.join(exportRoot, 'other-source', 'keep.txt');
    await writeFile(sentinel, 'Other source output');
    await writeFile(path.join(exportRoot, 'keep.txt'), 'Export root contents');

    const result = await exportDefaultSource({
      directory,
      filename,
      instance: agencyName === '///',
    });
    const folderName = `${folderPrefix}-4d967a30111bf29f0eba01c448b375c1629b2fed01cdfcc3aed91f1b57d5dd5e`;
    assert.deepEqual(
      (await readdir(exportRoot)).sort(),
      [folderName, 'keep.txt', 'other-source'].sort(),
    );
    assert.equal(await readFile(sentinel, 'utf8'), 'Other source output');
    assert.equal(
      await readFile(path.join(exportRoot, 'keep.txt'), 'utf8'),
      'Export root contents',
    );
    assert.ok(Buffer.byteLength(folderName) <= 255);
    const outputDirectory = path.join(exportRoot, folderName);
    assert.equal(result.sourceId, 'test');
    assert.equal(
      result.outputDirectory,
      path.join(await realpath(directory), 'gtfs-export', folderName),
    );
    assert.equal(path.isAbsolute(result.outputDirectory), true);
    assert.deepEqual(
      result.files
        .map(({ filename: exportedFilename }) => exportedFilename)
        .sort(),
      scheduleFilenames,
    );
    assert.deepEqual(
      (await readdir(outputDirectory)).sort(),
      scheduleFilenames,
    );
    const agencies = parse(
      await readFile(path.join(outputDirectory, 'agency.txt'), 'utf8'),
      { columns: true, skip_empty_lines: true },
    ) as { agency_name: string }[];
    assert.deepEqual(
      agencies.map((row) => row.agency_name),
      [agencyName],
    );
  });
}

test('default exports separate colliding agency and source spellings and only replace their own output', async (t) => {
  const { directory, filename, sqlite } = await prepareExportFixture(t, {
    fileBacked: true,
    sourceId: 'metro/a',
    agencyName: 'Complete / Transit',
  });
  const imported = await importGtfs({
    database: { client: sqlite },
    sources: [
      { sourceId: 'metro:a', schedule: { path: 'test/fixtures/complete' } },
    ],
  });
  assert.equal(imported.success, true);
  sqlite.close();

  const first = await exportDefaultSource({
    directory,
    filename,
    sourceId: 'metro/a',
  });
  const firstAgency = await readFile(
    path.join(first.outputDirectory, 'agency.txt'),
    'utf8',
  );
  const second = await exportDefaultSource({
    directory,
    filename,
    sourceId: 'metro:a',
    instance: true,
  });
  assert.notEqual(first.outputDirectory, second.outputDirectory);
  for (const result of [first, second]) {
    assert.match(
      path.basename(result.outputDirectory),
      /^complete_transit-[a-f0-9]{64}$/u,
    );
    assert.equal(
      path.dirname(result.outputDirectory),
      path.join(await realpath(directory), 'gtfs-export'),
    );
  }
  assert.equal(
    await readFile(path.join(first.outputDirectory, 'agency.txt'), 'utf8'),
    firstAgency,
  );

  await writeFile(
    path.join(first.outputDirectory, 'stale.txt'),
    'Remove on repeat export',
  );
  const secondSentinel = path.join(second.outputDirectory, 'keep.txt');
  await writeFile(secondSentinel, 'Keep the other source');
  const repeated = await exportDefaultSource({
    directory,
    filename,
    sourceId: 'metro/a',
    overwrite: true,
  });
  assert.equal(repeated.outputDirectory, first.outputDirectory);
  assert.deepEqual(
    (await readdir(first.outputDirectory)).sort(),
    scheduleFilenames,
  );
  assert.equal(await readFile(secondSentinel, 'utf8'), 'Keep the other source');
});
