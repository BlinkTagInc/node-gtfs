import fs from 'fs';

import Database from 'better-sqlite3';

import { untildify } from './file-utils.ts';

const dbs: { [key: string]: Database.Database } = {};

function setupDb(sqlitePath: string) {
  const db = new Database(untildify(sqlitePath));
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.pragma('temp_store = MEMORY');
  dbs[sqlitePath] = db;

  return db;
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
    if (dbs[sqlitePath]) {
      return dbs[sqlitePath];
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
    throw new Error(
      'Multiple databases open, please specify which one to use.',
    );
  }

  throw new Error('Unable to find database connection.');
}

export function closeDb(db: Database.Database | null = null): void {
  if (Object.keys(dbs).length === 0) {
    throw new Error(
      'No database connection. Call `openDb(config)` before using any methods.',
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new Error(
        'Multiple database connections. Pass the db you want to close as a parameter to `closeDb`.',
      );
    }

    db = dbs[Object.keys(dbs)[0]];
  }

  db.close();
  delete dbs[db.name];
}

export function deleteDb(db: Database.Database | null = null): void {
  if (Object.keys(dbs).length === 0) {
    throw new Error(
      'No database connection. Call `openDb(config)` before using any methods.',
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new Error(
        'Multiple database connections. Pass the db you want to delete as a parameter to `deleteDb`.',
      );
    }

    db = dbs[Object.keys(dbs)[0]];
  }

  db.close();

  fs.unlinkSync(db.name);

  delete dbs[db.name];
}
