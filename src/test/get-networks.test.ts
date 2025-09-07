import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getNetworks } from '../../dist/index.js';

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
