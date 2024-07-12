import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getBoardAlights } from '../index.ts';

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
