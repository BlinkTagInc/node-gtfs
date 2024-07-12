import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRouteNetworks } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRouteNetworks():', () => {
  it('should return empty array if no route_networks', () => {
    const networkId = 'not_real';

    const results = getRouteNetworks({
      network_id: networkId,
    });

    expect(results).toHaveLength(0);
  });
});
