import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getRunEvents } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRunEvents():', () => {
  it('should return empty array if no run events (TODS)', () => {
    const runEventId = 'fake-run-event-id';

    const results = getRunEvents({
      run_event_id: runEventId,
    });

    expect(results).toHaveLength(0);
  });
});
