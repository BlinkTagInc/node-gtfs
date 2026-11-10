import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import Database from 'better-sqlite3';
import { fixtureExtensions } from '../fixtures/extensions.ts';

import { gtfsScheduleReferenceRevision } from '../../src/schema/index.ts';
import {
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
} from '../../src/database/sqlite/schema-writer.ts';

interface SqliteSchemaStatement {
  type: string;
  name: string;
  tableName: string;
  sql: string;
}

interface SqliteSchemaSnapshot {
  formatVersion: number;
  scheduleReferenceRevision: string;
  statements: SqliteSchemaStatement[];
}

function normalizeSql(sql: string): string {
  return sql.replaceAll(/\s+/g, ' ').trim();
}

function currentSnapshot(): SqliteSchemaSnapshot {
  const db = new Database(':memory:');
  try {
    createSqliteGtfsTables({
      database: db,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });
    createSqliteGtfsIndexes({
      database: db,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });
    const statements = db
      .prepare(
        `SELECT type, name, tbl_name AS tableName, sql
         FROM sqlite_master
         WHERE type IN ('table', 'index') AND sql IS NOT NULL
         ORDER BY tbl_name, type, name`,
      )
      .all() as Array<SqliteSchemaStatement>;

    return {
      formatVersion: 1,
      scheduleReferenceRevision: gtfsScheduleReferenceRevision,
      statements: statements.map((statement) => ({
        ...statement,
        sql: normalizeSql(statement.sql),
      })),
    };
  } finally {
    db.close();
  }
}

test('generated SQLite DDL matches the checked-in v5 snapshot', async () => {
  const expected = JSON.parse(
    await readFile('test/fixtures/sqlite-schema.json', 'utf8'),
  ) as SqliteSchemaSnapshot;

  assert.deepEqual(currentSnapshot(), expected);
});

test('no registered Schedule, extension, or Realtime table imposes hard foreign keys', () => {
  const db = new Database(':memory:');
  try {
    createSqliteGtfsTables({
      database: db,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .pluck()
      .all() as string[];
    assert.ok(tables.includes('alerts'));
    assert.ok(tables.includes('vehicles'));
    for (const table of tables) {
      assert.deepEqual(
        db.prepare(`PRAGMA foreign_key_list("${table}")`).all(),
        [],
        table,
      );
    }
  } finally {
    db.close();
  }
});

test('storage-key strategies enforce distinct table cardinalities', () => {
  const db = new Database(':memory:');
  try {
    createSqliteGtfsTables({
      database: db,
      mode: 'recreate',
      extensions: fixtureExtensions,
    });

    const insertBoardAlight = db.prepare(
      `INSERT INTO board_alight
        (source_id, trip_id, stop_id, stop_sequence, record_use)
       VALUES (?, ?, ?, ?, ?)`,
    );
    insertBoardAlight.run('source', 'trip-1', 'stop', 1, 0);
    insertBoardAlight.run('source', 'trip-2', 'stop', 1, 0);
    assert.deepEqual(
      db.prepare('SELECT COUNT(*) AS count FROM board_alight').get(),
      { count: 2 },
    );

    const insertFeedInfo = db.prepare(
      `INSERT INTO feed_info
        (source_id, feed_publisher_name, feed_publisher_url, feed_lang)
       VALUES (?, ?, ?, ?)`,
    );
    insertFeedInfo.run('source', 'Publisher', 'https://example.com', 'en');
    assert.throws(() =>
      insertFeedInfo.run(
        'source',
        'Other publisher',
        'https://other.example.com',
        'en',
      ),
    );

    const insertAgency = db.prepare(
      `INSERT INTO agency
        (source_id, agency_id, agency_name, agency_url, agency_timezone,
         _node_gtfs_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertAgency.run(
      'source',
      null,
      'Agency',
      'https://example.com',
      'Etc/UTC',
      'a'.repeat(64),
    );
    assert.throws(() =>
      insertAgency.run(
        'source',
        null,
        'Other agency',
        'https://other.example.com',
        'Etc/UTC',
        'a'.repeat(64),
      ),
    );
  } finally {
    db.close();
  }
});
