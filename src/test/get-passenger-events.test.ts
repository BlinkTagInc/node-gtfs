import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getPassengerEvents,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getPassengerEvents():', () => {
  it('should return empty array if no passenger events (TIDES)', () => {
    const passengerEventId = 'fake-passenger-event-id';

    const results = getPassengerEvents({
      passenger_event_id: passengerEventId,
    });

    expect(results).toHaveLength(0);
  });
});
