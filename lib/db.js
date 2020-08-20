const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
let db;

exports.openDb = async config => {
  if (!db) {
    db = await sqlite.open({
      filename: config.sqlitePath || ':memory:',
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
