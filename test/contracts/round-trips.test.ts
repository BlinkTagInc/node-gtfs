import { databaseContract } from '../helpers/database-contract.ts';
import { verifyDatabase } from './cases/database-values.ts';
import { verifyPortableExtensionRoundTrips } from './cases/extension-roundtrip.ts';
import { verifyTodsV1RoundTrip } from './cases/tods.ts';

databaseContract(
  'preserves imported values, source policies, and exported rows',
  async ({ db, dialect }) => {
    await verifyDatabase(db, dialect);
  },
  ['postgres', 'mysql'],
);
databaseContract('round-trips portable extensions', async ({ db }) => {
  await verifyPortableExtensionRoundTrips({ client: db });
});
databaseContract('round-trips TODS v1', async ({ db }) => {
  await verifyTodsV1RoundTrip({ client: db });
});
