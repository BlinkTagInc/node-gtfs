import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getNetworks } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
