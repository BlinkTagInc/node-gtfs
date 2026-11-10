import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { completeFixturePath } from '../helpers/test-utils.ts';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

import { exportGtfs, importGtfs } from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';

const scheduleTables = Object.entries(gtfsManifest).filter(
  ([, definition]) =>
    definition.specification === 'gtfs-schedule' &&
    definition.filename !== null,
);

/** Reads every row of a table, ordered so snapshots compare deterministically. */
function snapshotTable(
  db: Database.Database,
  tableName: string,
  columns: string[],
): unknown[] {
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  return db
    .prepare(`SELECT ${columnList} FROM "${tableName}" ORDER BY ${columnList};`)
    .all() as unknown[];
}

function snapshotAll(db: Database.Database): Record<string, unknown[]> {
  const snapshot: Record<string, unknown[]> = {};
  for (const [tableName, definition] of scheduleTables) {
    snapshot[tableName] = snapshotTable(
      db,
      tableName,
      Object.keys(definition.fields),
    );
  }
  return snapshot;
}

const config = {
  database: {},
  sources: [
    {
      sourceId: 'test',
      schedule: { path: completeFixturePath },
    },
  ],
  reporting: { level: 'silent' as const },
};

describe('complete fixture:', () => {
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-roundtrip-'));
  const outputDirectory = path.join(temporaryDir, 'export');
  let original: Record<string, unknown[]>;
  let reimported: Record<string, unknown[]>;
  let sqlite: Database.Database;

  before(async () => {
    sqlite = new Database(':memory:');
    const database = { client: sqlite };
    await importGtfs({ ...config, database });
    original = snapshotAll(sqlite);

    await exportGtfs({
      database,
      export: { outputDirectory },
      reporting: config.reporting,
    });

    // Re-importing drops and recreates the tables, so the second snapshot
    // reflects only what survived the export.
    await importGtfs({
      database,
      sources: [{ sourceId: 'test', schedule: { path: outputDirectory } }],
      reporting: { level: 'silent' },
    });
    reimported = snapshotAll(sqlite);
  });

  after(async () => {
    sqlite.close();
    await rm(temporaryDir, { recursive: true, force: true });
  });

  it('should populate every gtfs-schedule table', () => {
    for (const [tableName] of scheduleTables) {
      assert.ok(original[tableName]!.length > 0);
    }
  });

  it('should leave no column entirely null', () => {
    const nullColumns: string[] = [];

    for (const [tableName, definition] of scheduleTables) {
      for (const column of Object.keys(definition.fields)) {
        const { filled } = sqlite
          .prepare(`SELECT COUNT("${column}") AS filled FROM "${tableName}";`)
          .get() as { filled: number };
        if (filled === 0) {
          nullColumns.push(`${tableName}.${column}`);
        }
      }
    }

    // The point of this fixture: every column carries a real value, so an
    // export or import that drops one is detectable.
    assert.deepEqual(nullColumns, []);
  });

  for (const [tableName] of scheduleTables) {
    it(`should round-trip every ${tableName} value through export`, () => {
      assert.deepEqual(reimported[tableName], original[tableName]);
    });
  }
});
