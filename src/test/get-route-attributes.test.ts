import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRouteAttributes } from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRouteAttributes():', () => {
  it('should return empty array if no route attributes', () => {
    const routeId = 'fake-route-id';

    const results = getRouteAttributes({
      route_id: routeId,
    });

    expect(results).toHaveLength(0);
  });
});
