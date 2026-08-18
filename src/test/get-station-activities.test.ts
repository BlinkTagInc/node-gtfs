import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getStationActivities,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStationActivities():', () => {
  it('should return empty array if no station activities (TIDES)', () => {
    const stopId = 'fake-stop-id';

    const results = getStationActivities({
      stop_id: stopId,
    });

    expect(results).toHaveLength(0);
  });
});
