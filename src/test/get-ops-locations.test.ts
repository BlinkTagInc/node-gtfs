import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getOpsLocations,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getOpsLocations():', () => {
  it('should return empty array if no ops locations (TODS)', () => {
    const opsLocationId = 'fake-ops-location-id';

    const results = getOpsLocations({
      ops_location_id: opsLocationId,
    });

    expect(results).toHaveLength(0);
  });
});
