import fs from 'fs';

import Database from 'better-sqlite3';
import untildify from 'untildify';

import { setDefaultConfig } from './utils.ts';
import { IConfig } from '../types/global_interfaces.ts';

const dbs: { [key: string]: Database.Database } = {};

function setupDb(sqlitePath: string) {
  const db = new Database(untildify(sqlitePath));
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.pragma('temp_store = MEMORY');
  dbs[sqlitePath] = db;

  return db;
}

export function openDb(config: IConfig | null = null): Database.Database {
  // If config is passed, use that to open or return db
  if (config) {
    const { sqlitePath, db } = setDefaultConfig(config);
    if (db) {
      return db;
    }

    if (dbs[sqlitePath]) {
      return dbs[sqlitePath];
    }

    return setupDb(sqlitePath);
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
