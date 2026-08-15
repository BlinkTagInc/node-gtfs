import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

import { describe, it, expect } from './test-utils.ts';
import { closeDb, GtfsErrorCode, openDb } from '../../dist/index.js';

describe('database connection lifecycle:', () => {
  it('should use one registered connection for equivalent normalized paths', async () => {
    const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-db-'));
    const absolutePath = path.join(temporaryDir, 'feed.sqlite');
    const relativePath = path.relative(process.cwd(), absolutePath);
    let relativeDb: Database.Database | undefined;

    try {
      relativeDb = openDb({ sqlitePath: relativePath });
      const absoluteDb = openDb({ sqlitePath: absolutePath });

      expect(absoluteDb).toBe(relativeDb);
      closeDb(absoluteDb);
    } finally {
      if (relativeDb?.open) {
        closeDb(relativeDb);
      }
      await rm(temporaryDir, { recursive: true, force: true });
    }
  });

  it('should close an explicitly passed unregistered database', () => {
    const explicitDb = new Database(':memory:');

    closeDb(explicitDb);

    expect(explicitDb.open).toBeFalsy();
  });

  it('should retain its existing error code while adding database context', () => {
    let caughtError: unknown;

    try {
      closeDb();
    } catch (error: unknown) {
      caughtError = error;
    }

    const error = caughtError as {
      code?: unknown;
      details?: Record<string, unknown>;
    };
    expect(error.code).toEqual(GtfsErrorCode.GTFS_DB_OPERATION_FAILED);
    expect(error.details?.openDatabaseCount).toEqual(0);
    expect(error.details?.openDatabaseNames).toEqual([]);
  });
});
