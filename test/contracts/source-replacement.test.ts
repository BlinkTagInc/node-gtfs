import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  databaseContract,
  openContractDatabase,
} from '../helpers/database-contract.ts';
import { verifySourceRevisionCoordination } from '../helpers/source-revision.ts';
import { verifySourceIsolationIntegration } from './cases/source-isolation.ts';
import { verifyAtomicSourceReplacement } from './cases/database-replacement.ts';

databaseContract(
  'isolates imported sources in queries and exports',
  async ({ db }) => {
    await verifySourceIsolationIntegration({ client: db });
  },
);
test('native SQLite isolates imported sources in queries and exports', async () => {
  const db = new Database(':memory:');
  try {
    await verifySourceIsolationIntegration({ client: db });
  } finally {
    db.close();
  }
});
databaseContract(
  'coordinates Schedule replacement and Realtime across connections',
  async ({ db, dialect }) => {
    const realtime = openContractDatabase(dialect);
    try {
      await verifySourceRevisionCoordination({
        scheduleDatabase: { client: db },
        realtimeDatabase: { client: realtime },
      });
    } finally {
      await realtime.destroy();
    }
  },
  ['postgres', 'mysql'],
);
databaseContract(
  'restores a source when replacement writing fails',
  async ({ db, dialect }) => {
    if (dialect !== 'sqlite') {
      await verifyAtomicSourceReplacement(db, dialect);
    }
  },
  ['postgres', 'mysql'],
);
