import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRidership } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRidership():', () => {
  it('should return empty array if no riderships (GTFS-ride)', () => {
    const routeId = 'fake-route-id';

    const results = getRidership({
      route_id: routeId,
    });

    expect(results).toHaveLength(0);
  });
});
