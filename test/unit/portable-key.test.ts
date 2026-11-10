import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { importGtfs } from '../../src/operations.ts';
import { describe, it } from 'node:test';
import { Gtfs } from '../../src/instance.ts';
import {
  digestGtfsCanonicalKey,
  encodeGtfsCanonicalKey,
} from '../../src/database/storage/key.ts';
import {
  portableKeyFixtures,
  writePortableKeyFixture,
} from '../helpers/portable-key-fixture.ts';
describe('canonical nullable storage keys:', () => {
  it('uses collision-safe tags and preserves null, empty, text, and numeric distinctions', () => {
    const inputs = [
      [null],
      [''],
      ['null'],
      [0],
      ['0'],
      [null, 'value'],
      ['', 'value'],
      ['value', null],
    ] as const;
    const encodings = inputs.map(encodeGtfsCanonicalKey);
    const digests = inputs.map(digestGtfsCanonicalKey);
    assert.deepEqual(new Set(encodings).size, inputs.length);
    assert.deepEqual(new Set(digests).size, inputs.length);
    assert.ok(digests.every((digest) => /^[a-f0-9]{64}$/.test(digest)));
  });
  it('enforces the same nulls-not-distinct matrix for every declared table in SQLite', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-portable-key-'));
    const db = new Database(':memory:');
    try {
      await writePortableKeyFixture(fixturePath);
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: fixturePath,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                  onDuplicateKey: 'keep-first',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      for (const { table } of portableKeyFixtures) {
        const { count, keyCount } = db
          .prepare(
            `SELECT COUNT(*) AS count, COUNT(DISTINCT _node_gtfs_key) AS keyCount FROM "${table}"`,
          )
          .get() as {
          count: number;
          keyCount: number;
        };
        assert.deepEqual(count, 1);
        assert.deepEqual(keyCount, 1);
      }
      db.prepare(
        `INSERT INTO fare_rules
          (source_id, fare_id, route_id, origin_id, destination_id, contains_id, _node_gtfs_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'test',
        'fare',
        '',
        null,
        null,
        null,
        digestGtfsCanonicalKey(['test', 'fare', '', null, null, null]),
      );
      const { count: distinctCount } = db
        .prepare('SELECT COUNT(*) AS count FROM fare_rules')
        .get() as {
        count: number;
      };
      assert.deepEqual(distinctCount, 2);
      const gtfs = new Gtfs({
        database: { client: db },
      });
      const fareRules = await gtfs.schedule.fareRules.all();
      assert.ok(
        fareRules.every((row) => !Object.hasOwn(row, '_node_gtfs_key')),
      );
      await gtfs.close();
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
  it('enforces the matrix through the portable Kysely writer', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-portable-key-kysely-'),
    );
    const sqlite = new Database(':memory:');
    const db = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    try {
      await writePortableKeyFixture(fixturePath);
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: fixturePath,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                  onDuplicateKey: 'keep-first',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      for (const { table } of portableKeyFixtures) {
        const { count, keyCount } = sqlite
          .prepare(
            `SELECT COUNT(*) AS count, COUNT(DISTINCT _node_gtfs_key) AS keyCount FROM "${table}"`,
          )
          .get() as {
          count: number;
          keyCount: number;
        };
        assert.deepEqual(count, 1);
        assert.deepEqual(keyCount, 1);
      }
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
  it('retains SQLite batch rollback when a canonical key is duplicated', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-portable-key-reject-'),
    );
    const db = new Database(':memory:');
    try {
      await writePortableKeyFixture(fixturePath);
      await assert.rejects(async () =>
        importGtfs({
          database: { client: db },
          sources: [
            {
              sourceId: 'portable-key',
              schedule: {
                path: fixturePath,
                excludeFiles: portableKeyFixtures
                  .filter(({ table }) => table !== 'fare_rules')
                  .map(({ filename }) => filename),
                import: {
                  validation: {
                    mode: 'permissive',
                    onUnknownField: 'discard',
                  },
                },
              },
            },
          ],
          reporting: { level: 'silent' },
        }),
      );
      const { count } = db
        .prepare('SELECT COUNT(*) AS count FROM fare_rules')
        .get() as {
        count: number;
      };
      assert.deepEqual(count, 0);
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
