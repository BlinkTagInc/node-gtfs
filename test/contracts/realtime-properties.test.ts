import { test } from 'node:test';
import Database from 'better-sqlite3';
import { databaseContract } from '../helpers/database-contract.ts';
import { verifyRealtimeProperties } from './cases/realtime-properties.ts';

databaseContract(
  'property: Realtime update sequences match a scoped state model',
  async ({ db }) => {
    await verifyRealtimeProperties({ client: db });
  },
);
test('native SQLite property: Realtime update sequences match a scoped state model', async () => {
  const db = new Database(':memory:');
  try {
    await verifyRealtimeProperties({ client: db });
  } finally {
    db.close();
  }
});
