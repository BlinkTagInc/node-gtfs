import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Gtfs,
  importGtfs,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/index.ts';
test('unsupported CSV options reject before downloads, reads, or source replacement', async (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  database.exec(
    "CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES ('original')",
  );
  const prepare = t.mock.method(database, 'prepare', () =>
    assert.fail('No SQL before CSV config validation'),
  );
  const fetch = t.mock.method(globalThis, 'fetch', () =>
    assert.fail('No downloads before CSV config validation'),
  );
  const read = t.mock.method(ReadStream.prototype, '_read', () =>
    assert.fail('No file reads before CSV config validation'),
  );
  const callback = () => assert.fail('CSV callbacks must not run');
  for (const extensions of [[], 'auto'] as const) {
    for (const csv of [
      { columns: false },
      { cast: true },
      { onRecord: callback },
      { on_record: callback },
      { skip_empty_lines: false },
      { encoding: false },
      { bogus: true },
      { parseOptions: { delimiter: ';' } },
      { bom: false },
      { bom: true },
    ]) {
      await assert.rejects(
        async () =>
          importGtfs({
            database: { client: database },
            extensions,
            sources: [
              {
                schedule: {
                  url: 'https://example.test/feed.zip',
                  import: { csv },
                },
              },
            ],
          } as never),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
          assert.match(error.message, /sources\[0\]\.schedule\.import\.csv\./);
          return true;
        },
      );
    }
  }
  assert.equal(prepare.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(read.mock.callCount(), 0);
  prepare.mock.restore();
  assert.deepEqual(database.prepare('SELECT value FROM sentinel').all(), [
    { value: 'original' },
  ]);
});
test('source-local CSV options preserve IDs and normalized values through an instance import', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-csv-contract-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'agency.txt'),
    '\uFEFFagency_id;agency_name;agency_url;agency_timezone\r\n001;"Café Transit";https://example.test;Etc/UTC\r\n',
    'utf16le',
  );
  await writeFile(
    path.join(directory, 'routes.txt'),
    '\uFEFFroute_id;agency_id;route_short_name;route_type\r\n001;001;"  Red  ";3\r\n',
    'utf16le',
  );
  const gtfs = new Gtfs({
    database: {},
    reporting: { level: 'silent' },
    sources: [
      {
        schedule: {
          path: directory,
          import: {
            csv: {
              encoding: 'utf16le',
              delimiter: ';',
              trim: false,
              relaxQuotes: false,
            },
            validation: { mode: 'permissive' },
          },
        },
      },
    ],
  });
  t.after(() => gtfs.close());
  const result = await gtfs.import();
  assert.equal(result.success, true);
  assert.deepEqual(
    await gtfs.schedule.routes
      .select('route_id', 'agency_id', 'route_short_name', 'route_type')
      .all(),
    [
      {
        route_id: '001',
        agency_id: '001',
        route_short_name: '  Red  ',
        route_type: 3,
      },
    ],
  );
  assert.equal(
    (await gtfs.schedule.agency.first())?.agency_name,
    'Café Transit',
  );
});
