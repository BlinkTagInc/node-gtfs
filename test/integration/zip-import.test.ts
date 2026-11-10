import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import Database from 'better-sqlite3';

import {
  importGtfs,
  GtfsErrorCode,
  GtfsErrorCategory,
  isGtfsError,
} from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';
import { completeFixturePath } from '../helpers/test-utils.ts';
import {
  encodeZipFixture,
  type ZipFixtureEntry,
} from '../helpers/zip-fixture.ts';

const feedEntries = await Promise.all(
  Object.values(gtfsManifest)
    .filter((table) => table.specification === 'gtfs-schedule')
    .map(async (table) => {
      assert.ok(table.filename);
      return {
        name: table.filename,
        content: await readFile(path.join(completeFixturePath, table.filename)),
      };
    }),
);

async function prepareImport(
  t: TestContext,
  entries: readonly ZipFixtureEntry[],
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-zip-import-'));
  const sqlite = new Database(':memory:');
  t.after(async () => {
    sqlite.close();
    await rm(directory, { recursive: true, force: true });
  });
  const archivePath = path.join(directory, 'feed.zip');
  await writeFile(archivePath, encodeZipFixture(entries));
  return {
    directory,
    sqlite,
    archivePath,
    run: () =>
      importGtfs({
        database: { client: sqlite },
        sources: [{ sourceId: 'zip', schedule: { path: archivePath } }],
        reporting: { level: 'silent' },
      }),
  };
}

for (const macosMetadata of [false, true]) {
  test(`imports one nested feed directory${macosMetadata ? ' alongside __MACOSX' : ''}`, async (t) => {
    const entries = feedEntries.map((entry) => ({
      ...entry,
      name: `feed/${entry.name}`,
    }));
    entries.push({
      name: 'notes.txt',
      content: Buffer.from('Archive readme, not a GTFS table'),
    });
    if (macosMetadata) {
      entries.push({
        name: '__MACOSX/feed/._agency.txt',
        content: Buffer.from('Not CSV data'),
      });
    }
    const { sqlite, run } = await prepareImport(t, entries);
    assert.equal((await run()).success, true);
    assert.deepEqual(
      sqlite.prepare('select source_id, agency_id from agency').all(),
      [{ source_id: 'zip', agency_id: 'FA1' }],
    );
    assert.deepEqual(
      sqlite
        .prepare('select route_id from routes order by route_id')
        .pluck()
        .all(),
      ['FR1', 'FR2'],
    );
    assert.deepEqual(
      sqlite.prepare('select id from locations order by id').pluck().all(),
      ['FLOC1', 'FLOC2'],
    );
  });
}

const invalidLayouts = [
  {
    name: 'an empty ZIP',
    entries: [],
    message: /no GTFS files found/,
    folderCount: undefined,
  },
  {
    name: 'multiple feed directories',
    entries: ['first', 'second'].flatMap((directory) =>
      feedEntries.map((entry) => ({
        ...entry,
        name: `${directory}/${entry.name}`,
      })),
    ),
    message: /found more than one feed directory/,
    folderCount: 2,
  },
  ...['README.md', 'notes.txt', 'feed/notes.txt', '__MACOSX/._agency.txt'].map(
    (name) => ({
      name: `no recognizable GTFS files (${name})`,
      entries: [{ name, content: 'Not a GTFS feed' }],
      message: /no GTFS files found/,
      folderCount: undefined,
    }),
  ),
];
for (const fixture of invalidLayouts) {
  test(`rejects ${fixture.name}`, async (t) => {
    const { sqlite, archivePath, run } = await prepareImport(
      t,
      fixture.entries,
    );
    await assert.rejects(run, (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.ZIP_INVALID);
      assert.equal(error.category, GtfsErrorCategory.ZIP);
      assert.equal(error.details?.sourcePath, archivePath);
      assert.match(error.message, fixture.message);
      if (fixture.folderCount !== undefined) {
        assert.equal(error.details?.folderCount, fixture.folderCount);
      }
      return true;
    });
    assert.equal(
      sqlite.prepare('select count(*) from agency').pluck().get(),
      0,
    );
    assert.equal(
      sqlite.prepare('select count(*) from routes').pluck().get(),
      0,
    );
  });
}

test('public import rejects traversal before writing outside staging or importing rows', async (t) => {
  const { directory, sqlite, archivePath, run } = await prepareImport(t, []);
  const sentinel = path.join(directory, 'outside.txt');
  await writeFile(sentinel, 'untouched');
  // Import staging is a sibling under tmpdir; even a regression can only
  // overwrite this test's sentinel, never a file outside its sandbox.
  const maliciousName = `../${path.basename(directory)}/outside.txt`;
  await writeFile(
    archivePath,
    encodeZipFixture([
      ...feedEntries,
      { name: maliciousName, content: 'overwritten' },
    ]),
  );
  await assert.rejects(run, (error: unknown) => {
    assert.ok(isGtfsError(error));
    assert.equal(error.code, GtfsErrorCode.ZIP_INVALID);
    assert.equal(error.category, GtfsErrorCategory.ZIP);
    assert.equal(error.details?.sourcePath, archivePath);
    assert.ok(error.cause instanceof Error);
    assert.match(error.cause.message, /invalid relative path/);
    return true;
  });
  assert.equal(await readFile(sentinel, 'utf8'), 'untouched');
  assert.deepEqual((await readdir(directory)).sort(), [
    'feed.zip',
    'outside.txt',
  ]);
  assert.equal(sqlite.prepare('select count(*) from agency').pluck().get(), 0);
  assert.equal(sqlite.prepare('select count(*) from routes').pluck().get(), 0);
});
