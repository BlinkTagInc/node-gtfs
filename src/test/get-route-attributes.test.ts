import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRouteAttributes,
} from '../../dist/index.js';

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
