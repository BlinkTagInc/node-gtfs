import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getNetworks } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getNetworks():', () => {
  it('should return empty array if no networks', () => {
    const networkId = 'not_real';

    const results = getNetworks({
      network_id: networkId,
    });

    expect(results).toHaveLength(0);
  });
});
