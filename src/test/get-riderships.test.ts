import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRidership } from '../index.ts';

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
