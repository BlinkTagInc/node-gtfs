const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { setDefaultConfig } = require('./utils');
let db;

exports.openDb = async initialConfig => {
  const config = setDefaultConfig(initialConfig);
  if (!db) {
    db = await sqlite.open({
      filename: config.sqlitePath,
      driver: sqlite3.Database
    });
  }

  return db;
};

exports.closeDb = async () => {
  await db.close();
  db = undefined;
};

exports.getDb = () => {
  if (db) {
    return db;
  }

  throw new Error('No database connection. Call `gtfs.openDb(config)` before using any methods.');
};
