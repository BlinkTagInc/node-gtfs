import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRouteNetworks,
} from '../../dist/index.js';

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
