import fs from 'fs';

import Database from 'better-sqlite3';

import { expandHomeDirectory } from '../../io/paths.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  createGtfsConfigError,
} from '../../diagnostics/errors.ts';
import { assertConfigOptionKeys } from '../../config/options.ts';
import { configureOwnedSqliteConnection } from './durability.ts';
import { DEFAULT_GTFS_DATABASE_CONFIG } from '../../config/defaults.ts';
import { withSyncDatabaseCleanup } from '../cleanup.ts';

export function createOwnedSqliteDatabase(path: string): Database.Database {
  let database: Database.Database | undefined;
  try {
    database = new Database(expandHomeDirectory(path));
    configureOwnedSqliteConnection(database, path);
    return database;
  } catch (error: unknown) {
    return withSyncDatabaseCleanup(
      () => {
        throw new GtfsError(
          `Could not open SQLite database ${JSON.stringify(path)}; ensure its parent directory exists and is writable`,
          {
            code: GtfsErrorCode.DATABASE_OPEN_FAILED,
            category: GtfsErrorCategory.DATABASE,
            details: {
              path,
              dbCode: (error as { code?: string } | null | undefined)?.code,
            },
            cause: error,
          },
        );
      },
      () => {
        if (database?.open) {
          database.close();
        }
      },
    );
  }
}

export function openSqliteDatabase(
  options: Readonly<{
    client?: Database.Database;
    path?: string;
  }> = {},
): Database.Database {
  assertConfigOptionKeys(options, {
    name: 'openSqliteDatabase()',
    keys: ['path', 'client'],
    removed: { sqlitePath: 'path', db: 'client' },
  });
  const { path, client } = options;
  if (path !== undefined && typeof path !== 'string') {
    throw createGtfsConfigError(
      'The `openSqliteDatabase()` option `path` must be a string',
      {
        path: 'path',
      },
    );
  }
  if (path !== undefined && client !== undefined) {
    throw createGtfsConfigError(
      'The `openSqliteDatabase()` options `path` and `client` are mutually exclusive',
      {
        path: 'client',
      },
    );
  }
  if (client !== undefined) {
    if (!(client instanceof Database) || !client.open) {
      throw createGtfsConfigError(
        'The `openSqliteDatabase()` option `client` must be an open better-sqlite3 connection',
        { path: 'client' },
      );
    }
    return client;
  }
  return createOwnedSqliteDatabase(path ?? DEFAULT_GTFS_DATABASE_CONFIG.path);
}

export function closeSqliteDatabase(database: Database.Database): void {
  database.close();
}

export function deleteSqliteDatabase(database: Database.Database): void {
  database.close();

  if (database.name !== ':memory:') {
    fs.unlinkSync(database.name);
  }
}
