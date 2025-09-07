import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getStopAttributes,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStopAttributes():', () => {
  it('should return empty array if no stop attributes', () => {
    const stopId = 'fake-stop-id';

    const results = getStopAttributes({
      stop_id: stopId,
    });

    expect(results).toHaveLength(0);
  });
});
