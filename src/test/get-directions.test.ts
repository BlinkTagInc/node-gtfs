import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getDirections } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
  closeDb(db);
});

describe('getDirections():', () => {
  it('should return empty array if no directions', () => {
    const fareRouteId = 'not_real';

    const results = getDirections({
      route_id: fareRouteId,
    });

    expect(results).toHaveLength(0);
  });
});
