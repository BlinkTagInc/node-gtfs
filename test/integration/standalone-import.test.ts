import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  Gtfs,
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
} from '../../src/index.ts';

const sources = [{ schedule: { path: 'test/fixtures/complete' } }];

for (const extensions of [[], 'auto'] as const) {
  test(`standalone import requires an explicit destination with extensions=${JSON.stringify(extensions)}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      assert.fail('Invalid import configuration must not download a feed');
    });
    t.mock.method(Database.prototype, 'pragma', () => {
      assert.fail(
        'Invalid import configuration must not configure a connection',
      );
    });
    for (const database of [
      {},
      { path: undefined },
      { client: undefined },
      { path: '' },
      { path: '   ' },
    ]) {
      await assert.rejects(
        importGtfs({
          database,
          extensions,
          sources: [{ schedule: { url: 'https://example.test/feed.zip' } }],
        } as never),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
          assert.equal(error.category, 'config');
          assert.deepEqual(
            error.details?.errors?.map(({ path }) => path),
            ['database.path'],
          );
          assert.match(
            error.message,
            /explicit `database.path` or a caller-owned `database.client`/,
          );
          assert.match(error.message, /discard it when import completes/);
          return true;
        },
      );
    }
  });

  test(`standalone import preserves an explicit file and accepts explicit disposable memory with extensions=${JSON.stringify(extensions)}`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-import-destination-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const databasePath = path.join(directory, 'feed.sqlite');
    const result = await importGtfs({
      database: { path: databasePath },
      sources,
      extensions,
    });
    assert.equal(result.success, true);
    const stored = new Database(databasePath, { readonly: true });
    try {
      assert.ok(
        (stored
          .prepare('SELECT COUNT(*) FROM routes')
          .pluck()
          .get() as number) > 0,
      );
    } finally {
      stored.close();
    }
    const disposable = await importGtfs({
      database: { path: ':memory:' },
      sources,
      extensions,
    });
    assert.equal(disposable.success, true);
  });
}

test('instances still default to in-memory storage usable after import', async () => {
  const gtfs = new Gtfs({ database: {}, sources });
  try {
    const result = await gtfs.import();
    assert.equal(result.success, true);
    assert.ok((await gtfs.schedule.routes.all()).length > 0);
  } finally {
    await gtfs.close();
  }
});
