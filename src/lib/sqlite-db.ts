import fs from 'fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { untildify } from './file-utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

const dbs: { [key: string]: Database.Database } = {};

function normalizeSqlitePath(sqlitePath: string): string {
  if (sqlitePath === ':memory:') {
    return sqlitePath;
  }

  return path.resolve(untildify(sqlitePath));
}

function getOpenDatabaseDetails() {
  return {
    openDatabaseCount: Object.keys(dbs).length,
    openDatabaseNames: Object.values(dbs).map((db) => db.name),
  };
}

function unregisterDb(db: Database.Database): void {
  for (const [sqlitePath, registeredDb] of Object.entries(dbs)) {
    if (registeredDb === db) {
      delete dbs[sqlitePath];
    }
  }
}

function setupDb(sqlitePath: string) {
  const db = new Database(untildify(sqlitePath));
  try {
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -256000');
    dbs[normalizeSqlitePath(sqlitePath)] = db;

    return db;
  } catch (error: unknown) {
    db.close();
    throw error;
  }
}

export function openDb(
  config: { db?: Database.Database; sqlitePath?: string } | null = null,
): Database.Database {
  // If config is passed, use that to open or return db
  if (config) {
    const { sqlitePath = ':memory:', db } = config;

    // If db connection is passed, use it
    if (db) {
      return db;
    }

    // If db connection already exists, return it
    const normalizedSqlitePath = normalizeSqlitePath(sqlitePath);
    if (dbs[normalizedSqlitePath]?.open) {
      return dbs[normalizedSqlitePath];
    }
    if (dbs[normalizedSqlitePath]) {
      delete dbs[normalizedSqlitePath];
    }

    // If no db connection exists, create it
    return setupDb(sqlitePath);
  }

  // If no db connection exists, create a new one in memory
  if (Object.keys(dbs).length === 0) {
    return setupDb(':memory:');
  }

  // If only one db connection already exists, use it
  if (Object.keys(dbs).length === 1) {
    const filename = Object.keys(dbs)[0];
    return dbs[filename];
  }

  if (Object.keys(dbs).length > 1) {
    throw new GtfsError(
      'Multiple databases open, please specify which one to use.',
      {
        code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
        category: GtfsErrorCategory.DATABASE,
        details: getOpenDatabaseDetails(),
      },
    );
  }

  throw new GtfsError('Unable to find database connection.', {
    code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
    category: GtfsErrorCategory.DATABASE,
    details: getOpenDatabaseDetails(),
  });
}

export function closeDb(db: Database.Database | null = null): void {
  if (!db && Object.keys(dbs).length === 0) {
    throw new GtfsError(
      'No database connection. Call `openDb(config)` before using any methods.',
      {
        code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
        category: GtfsErrorCategory.DATABASE,
        details: getOpenDatabaseDetails(),
      },
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new GtfsError(
        'Multiple database connections. Pass the db you want to close as a parameter to `closeDb`.',
        {
          code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: getOpenDatabaseDetails(),
        },
      );
    }

    db = dbs[Object.keys(dbs)[0]];
  }

  db.close();
  unregisterDb(db);
}

export function deleteDb(db: Database.Database | null = null): void {
  if (Object.keys(dbs).length === 0) {
    throw new GtfsError(
      'No database connection. Call `openDb(config)` before using any methods.',
      {
        code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
        category: GtfsErrorCategory.DATABASE,
        details: getOpenDatabaseDetails(),
      },
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new GtfsError(
        'Multiple database connections. Pass the db you want to delete as a parameter to `deleteDb`.',
        {
          code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: getOpenDatabaseDetails(),
        },
      );
    }

    db = dbs[Object.keys(dbs)[0]];
  }

  db.close();

  if (db.name !== ':memory:') {
    fs.unlinkSync(db.name);
  }

  unregisterDb(db);
}
