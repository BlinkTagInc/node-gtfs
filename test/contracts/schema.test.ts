import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  createSqliteGtfsIndexes,
  createSqliteGtfsTables,
  inspectSqliteGtfsSchema,
} from '../../src/sqlite.ts';
import { databaseContract } from '../helpers/database-contract.ts';
import { verifySchemaDriftMatrix } from './cases/database-schema.ts';

databaseContract(
  'reports the complete schema drift matrix',
  async ({ db, dialect }) => {
    await verifySchemaDriftMatrix(db, dialect);
  },
);

test('native SQLite reports the complete schema drift matrix', async () => {
  const sqlite = new Database(':memory:');
  const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
  try {
    await verifySchemaDriftMatrix(db, 'sqlite', {
      recreate: () => {
        createSqliteGtfsTables({ database: sqlite, mode: 'recreate' });
        createSqliteGtfsIndexes({ database: sqlite, mode: 'ensure' });
      },
      inspect: () =>
        inspectSqliteGtfsSchema({ database: sqlite, includeIndexes: true }),
    });
  } finally {
    await db.destroy();
  }
});
