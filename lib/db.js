import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { setDefaultConfig } from './utils.js';
import untildify from 'untildify';
const dbs = {};

export async function openDb(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  if (!dbs[config.sqlitePath]) {
    dbs[config.sqlitePath] = await open({
      filename: untildify(config.sqlitePath),
      driver: sqlite3.Database,
    });
  }

  return dbs[config.sqlitePath];
}

export async function setupDb(db) {
  if (Object.keys(dbs).length === 0) {
    throw new Error(
      'No database connection. Call `openDb(config)` before using any methods.'
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new Error(
        'Multiple database connections. Pass the db you want to close as a parameter to `setupDb`.'
      );
    }

    const filename = Object.keys(dbs)[0];
    db = dbs[filename];
  }

  await db.run('PRAGMA journal_mode = OFF;');
  await db.run('PRAGMA synchronous = 0;');
  await db.run('PRAGMA locking_mode = EXCLUSIVE;');
  await db.run('PRAGMA temp_store = MEMORY;');
  await db.run('VACUUM;');
}

export async function closeDb(db) {
  if (Object.keys(dbs).length === 0) {
    throw new Error(
      'No database connection. Call `openDb(config)` before using any methods.'
    );
  }

  if (!db) {
    if (Object.keys(dbs).length > 1) {
      throw new Error(
        'Multiple database connections. Pass the db you want to close as a parameter to `closeDb`.'
      );
    }

    db = dbs[Object.keys(dbs)[0]];
  }

  const { filename } = db.config;

  await db.close();
  delete dbs[filename];
}

export function getDb(initialConfig) {
  if (Object.keys(dbs).length === 0) {
    throw new Error(
      'No database connection. Call `openDb(config)` before using any methods.'
    );
  }

  const config = setDefaultConfig(initialConfig);
  if (dbs[config.sqlitePath]) {
    return dbs[config.sqlitePath];
  }

  /*
   * Fall back to using the only open database connection if only
   * one exists for backwards compatibility
   */
  if (Object.keys(dbs).length === 1) {
    const filename = Object.keys(dbs)[0];
    return dbs[filename];
  }

  throw new Error('Unable to find database connection.');
}
