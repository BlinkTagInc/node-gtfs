import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { setDefaultConfig } from './utils.js';
let db;

export async function openDb(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  if (!db) {
    db = await open({
      filename: config.sqlitePath,
      driver: sqlite3.Database
    });
  }

  return db;
}

export async function setupDb() {
  await db.run('PRAGMA journal_mode = OFF;');
  await db.run('PRAGMA synchronous = 0;');
  await db.run('PRAGMA locking_mode = EXCLUSIVE;');
  await db.run('PRAGMA temp_store = MEMORY;');
  await db.run('VACUUM;');
}

export async function closeDb() {
  await db.close();
  db = undefined;
}

export function getDb() {
  if (db) {
    return db;
  }

  throw new Error('No database connection. Call `openDb(config)` before using any methods.');
}
