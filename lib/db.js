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

export async function closeDb() {
  await db.close();
  db = undefined;
}

export function getDb() {
  if (db) {
    return db;
  }

  throw new Error('No database connection. Call `gtfs.openDb(config)` before using any methods.');
}
