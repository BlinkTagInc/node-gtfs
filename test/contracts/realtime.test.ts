import { databaseContract } from '../helpers/database-contract.ts';
import {
  verifyPortableRealtimeIngestion,
  verifyRealtimeFidelityAndRollback,
} from './cases/database-realtime.ts';

databaseContract(
  'preserves Realtime fidelity and rolls back failed snapshots',
  async ({ db, dialect }) => {
    await verifyRealtimeFidelityAndRollback(db, dialect);
  },
  ['sqlite'],
);
databaseContract(
  'applies full, differential, and tombstone feeds with rollback',
  async ({ db, dialect }) => {
    if (dialect !== 'sqlite') {
      await verifyPortableRealtimeIngestion(db, dialect);
    }
  },
  ['postgres', 'mysql'],
);
