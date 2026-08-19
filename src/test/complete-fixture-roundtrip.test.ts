import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
  completeFixturePath,
} from './test-utils.ts';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { openDb, closeDb, importGtfs, exportGtfs } from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';

const scheduleTables = Object.entries(gtfsManifest).filter(
  ([, definition]) =>
    definition.namespace === 'gtfs-schedule' && definition.file !== null,
);

/** Reads every row of a table, ordered so snapshots compare deterministically. */
function snapshotTable(
  db: ReturnType<typeof openDb>,
  tableName: string,
  columns: string[],
): unknown[] {
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  return db
    .prepare(`SELECT ${columnList} FROM "${tableName}" ORDER BY ${columnList};`)
    .all() as unknown[];
}

function snapshotAll(db: ReturnType<typeof openDb>): Record<string, unknown[]> {
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
  agencies: [{ path: completeFixturePath }],
  logLevel: 'silent' as const,
};

describe('complete fixture:', () => {
  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-roundtrip-'));
  const exportPath = path.join(temporaryDir, 'export');
  let original: Record<string, unknown[]>;
  let reimported: Record<string, unknown[]>;

  beforeAll(async () => {
    openDb();
    await importGtfs(config);
    original = snapshotAll(openDb());

    await exportGtfs({ ...config, exportPath });

    // Re-importing drops and recreates the tables, so the second snapshot
    // reflects only what survived the export.
    await importGtfs({
      agencies: [{ path: exportPath }],
      logLevel: 'silent',
    });
    reimported = snapshotAll(openDb());
  });

  afterAll(async () => {
    closeDb(openDb());
    await rm(temporaryDir, { recursive: true, force: true });
  });

  it('should populate every gtfs-schedule table', () => {
    for (const [tableName] of scheduleTables) {
      expect(original[tableName].length).toBeGreaterThan(0);
    }
  });

  it('should leave no column entirely null', () => {
    const db = openDb();
    const nullColumns: string[] = [];

    for (const [tableName, definition] of scheduleTables) {
      for (const column of Object.keys(definition.fields)) {
        const { filled } = db
          .prepare(`SELECT COUNT("${column}") AS filled FROM "${tableName}";`)
          .get() as { filled: number };
        if (filled === 0) {
          nullColumns.push(`${tableName}.${column}`);
        }
      }
    }

    // The point of this fixture: every column carries a real value, so an
    // export or import that drops one is detectable.
    expect(nullColumns).toEqual([]);
  });

  for (const [tableName] of scheduleTables) {
    it(`should round-trip every ${tableName} value through export`, () => {
      expect(reimported[tableName]).toEqual(original[tableName]);
    });
  }
});
