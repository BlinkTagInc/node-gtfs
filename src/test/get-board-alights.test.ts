import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getBoardAlights,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getBoardAlights():', () => {
  it('should return empty array if no board alights (GTFS-ride)', () => {
    const tripId = 'fake-trip-id';

    const results = getBoardAlights({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });
});
