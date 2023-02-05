import Database from 'better-sqlite3';
import untildify from 'untildify';

import { setDefaultConfig } from './utils.js';
const dbs = {};

const getOrCreateDbConnection = (sqlitePath) => {
  if (dbs[sqlitePath]) {
    return dbs[sqlitePath];
  }

  const db = new Database(untildify(sqlitePath));
  setupDb(db);

  dbs[sqlitePath] = db;
  return db;
};

export function openDb(config) {
  if (config) {
    return getOrCreateDbConnection(setDefaultConfig(config).sqlitePath);
  }

  // If only one db connection already exists, use it
  if (Object.keys(dbs).length === 1) {
    const filename = Object.keys(dbs)[0];
    return dbs[filename];
  }

  if (Object.keys(dbs).length > 1) {
    throw new Error(
      'Multiple databases open, please specify which one to use.'
    );
  }

  throw new Error('Unable to find database connection.');
}

export function setupDb(db) {
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.pragma('temp_store = MEMORY');
}

export function closeDb(db) {
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

  db.close();
  delete dbs[db.name];
}
