import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { importGtfs, type GtfsReportEvent } from '../../src/index.ts';
import { describe, it } from 'node:test';
import config from '../helpers/test-config.ts';

describe('schedule.excludeFiles:', () => {
  it('omits parsing and rows without changing the extension schema', async () => {
    const db = new Database(':memory:');
    const events: GtfsReportEvent[] = [];

    try {
      await importGtfs({
        ...config,
        database: { client: db },
        sources: [
          {
            ...config.sources[0],
            schedule: {
              ...config.sources[0].schedule,
              excludeFiles: ['shapes.txt'],
            },
          },
        ],
        reporting: {
          level: 'info',
          reporter(event) {
            events.push(event);
          },
        },
      });

      const shapesTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'shapes'",
        )
        .get();
      const shapeIndexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'shapes'",
        )
        .all();

      assert.deepEqual(shapesTable, { name: 'shapes' });
      assert.ok(shapeIndexes.length > 0);
      assert.deepEqual(
        db.prepare('SELECT COUNT(*) FROM shapes').pluck().get(),
        0,
      );
      assert.ok(!events.some((event) => event.message.includes('shapes.txt')));
    } finally {
      db.close();
    }
  });

  it('keeps a table needed by another configured source', async () => {
    const db = new Database(':memory:');

    try {
      await importGtfs({
        ...config,
        database: { client: db },
        sources: [
          {
            ...config.sources[0],
            sourceId: 'without-shapes',
            schedule: {
              ...config.sources[0].schedule,
              excludeFiles: ['shapes.txt'],
            },
          },
          {
            ...config.sources[0],
            sourceId: 'with-shapes',
          },
        ],
      });

      const sourceIds = db
        .prepare('SELECT DISTINCT source_id FROM shapes ORDER BY source_id')
        .all() as Array<{ source_id: string }>;
      assert.deepEqual(sourceIds, [{ source_id: 'with-shapes' }]);
    } finally {
      db.close();
    }
  });

  it('uses the same lifecycle subset through the portable writer', async () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      await importGtfs({
        ...config,
        database: { client: db },
        sources: [
          {
            ...config.sources[0],
            schedule: {
              ...config.sources[0].schedule,
              excludeFiles: ['shapes.txt'],
            },
          },
        ],
      });

      const shapesTable = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'shapes'",
        )
        .get();
      const shapeIndexes = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'shapes'",
        )
        .all();
      assert.deepEqual(shapesTable, { name: 'shapes' });
      assert.ok(shapeIndexes.length > 0);
      assert.deepEqual(
        sqlite.prepare('SELECT COUNT(*) FROM shapes').pluck().get(),
        0,
      );
    } finally {
      await db.destroy();
    }
  });
});
