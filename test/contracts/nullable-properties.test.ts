import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/database.ts';
import { databaseContract } from '../helpers/database-contract.ts';
import { verifyNullableProperties } from './cases/nullable-properties.ts';

databaseContract(
  'property: nullable predicates match an independent row filter',
  async ({ db }) => {
    await verifyNullableProperties(db as unknown as Kysely<GtfsDatabase>);
  },
);
test('native SQLite property: nullable predicates match an independent row filter', async () => {
  const sqlite = new Database(':memory:');
  const db = new Kysely<GtfsDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    await verifyNullableProperties(db, sqlite);
  } finally {
    await db.destroy();
  }
});
