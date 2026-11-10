import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';

import { exportGtfs, importGtfs } from '../../src/operations.ts';

describe('v5 export configuration', () => {
  test('uses nested destination, source selection, and batch size', async () => {
    const createTemporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-v5-export-'),
    );
    const outputDirectory = path.join(createTemporaryDirectory, 'output');
    const database = new Database(':memory:');
    try {
      await importGtfs({
        database: { client: database },
        sources: [
          {
            sourceId: 'complete',
            schedule: {
              path: 'test/fixtures/complete',
              import: { validation: { mode: 'permissive' } },
            },
          },
        ],
      });

      await exportGtfs({
        database: { client: database },
        export: {
          outputDirectory,
          sourceId: 'complete',
          batchSize: 2,
        },
      });

      assert.equal(existsSync(path.join(outputDirectory, 'agency.txt')), true);
      assert.equal(
        existsSync(path.join(outputDirectory, 'locations.geojson')),
        true,
      );
    } finally {
      database.close();
      await rm(createTemporaryDirectory, { recursive: true, force: true });
    }
  });

  test('rejects unknown export fields before touching the database', async (t) => {
    const database = new Database(':memory:');
    t.after(() => database.close());
    const prepare = t.mock.method(database, 'prepare', () => {
      throw new Error('Invalid export options must not reach SQL');
    });
    await assert.rejects(
      exportGtfs({
        database: { client: database },
        export: { unknown: true },
      } as never),
      { code: 'GTFS_CONFIG_INVALID' },
    );
    assert.equal(prepare.mock.callCount(), 0);
  });
});
