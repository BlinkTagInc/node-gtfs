import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRiderships } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getRiderships():', () => {
  it('should return empty array if no riderships (GTFS-ride)', () => {
    const routeId = 'fake-route-id';

    const results = getRiderships({
      route_id: routeId,
    });

    expect(results).toHaveLength(0);
  });
});
