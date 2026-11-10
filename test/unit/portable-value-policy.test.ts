import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Gtfs } from '../../src/instance.ts';
import { importGtfs } from '../../src/operations.ts';
import { digestGtfsCanonicalKey } from '../../src/database/storage/key.ts';
import { createSqliteGtfsTables } from '../../src/database/sqlite/schema-writer.ts';
import { foldGtfsText } from '../../src/values/case-fold.ts';
import { describe, it } from 'node:test';
describe('portable scalar and collation policy', () => {
  it('uses pinned full Unicode folding followed by NFC', () => {
    assert.equal(foldGtfsText('Straße'), 'strasse');
    assert.equal(foldGtfsText('Σςσ'), 'σσσ');
    assert.equal(foldGtfsText('İ'), 'i\u0307');
    assert.equal(foldGtfsText('Å'), foldGtfsText('A\u030A'));
  });
  it('uses exact binary equality, uniqueness, and ordering in SQLite', () => {
    const db = new Database(':memory:');
    try {
      createSqliteGtfsTables({ database: db, mode: 'recreate' });
      const insert = db.prepare(`INSERT INTO agency
          (source_id, agency_id, agency_name, agency_url, agency_timezone,
           _node_gtfs_key)
         VALUES ('test', ?, ?, 'https://example.com', 'Etc/UTC', ?)`);
      insert.run('A', 'lowercase', digestGtfsCanonicalKey(['test', 'A']));
      insert.run('a', 'Uppercase', digestGtfsCanonicalKey(['test', 'a']));
      const ids = db
        .prepare('SELECT agency_id FROM agency ORDER BY agency_id')
        .all() as Array<{
        agency_id: string;
      }>;
      assert.deepEqual(ids, [{ agency_id: 'A' }, { agency_id: 'a' }]);
      assert.throws(() =>
        insert.run('A', 'duplicate', digestGtfsCanonicalKey(['test', 'A'])),
      );
      const ddl = db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'agency'",
        )
        .get() as {
        sql: string;
      };
      assert.match(ddl.sql, /"agency_name" text[^,]*COLLATE BINARY/i);
      assert.match(
        ddl.sql,
        /"_node_gtfs_casefold_agency_name" TEXT COLLATE BINARY/,
      );
    } finally {
      db.close();
    }
  });
  it('round-trips exact minor units and populates hidden fold shadows', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-values-'));
    const db = new Database(':memory:');
    try {
      await Promise.all([
        writeFile(
          path.join(fixturePath, 'agency.txt'),
          [
            'agency_id,agency_name,agency_url,agency_timezone',
            'agency-1,Straße Transit,https://example.com,Etc/UTC',
            '',
          ].join('\n'),
        ),
        writeFile(
          path.join(fixturePath, 'fare_attributes.txt'),
          [
            'fare_id,price,currency_type,payment_method,transfers',
            'fare-1,92233720368547758.07,USD,0,0',
            '',
          ].join('\n'),
        ),
      ]);
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
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      const storedFare = db
        .prepare(
          'SELECT TYPEOF(price) AS type, CAST(price AS TEXT) AS price FROM fare_attributes',
        )
        .get() as {
        type: string;
        price: string;
      };
      assert.deepEqual(storedFare, {
        type: 'integer',
        price: '9223372036854775807',
      });
      const gtfs = new Gtfs({
        database: { client: db },
      });
      assert.equal(
        (
          await gtfs.schedule.fareAttributes
            .where({ fare_id: 'fare-1' })
            .first()
        )?.price,
        '92233720368547758.07',
      );
      assert.equal(
        (
          await gtfs.schedule.fareAttributes
            .where({
              price: '92233720368547758.07',
              currency_type: 'USD',
            })
            .all()
        ).length,
        1,
      );
      await assert.rejects(
        async () =>
          gtfs.schedule.fareAttributes
            .where({ price: '92233720368547758.07' })
            .all(),
        (error: unknown) =>
          (
            error as {
              code?: string;
            }
          ).code === 'GTFS_QUERY_INVALID',
      );
      await gtfs.close();
      const shadow = db
        .prepare('SELECT _node_gtfs_casefold_agency_name AS value FROM agency')
        .get() as {
        value: string;
      };
      assert.equal(shadow.value, 'strasse transit');
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
