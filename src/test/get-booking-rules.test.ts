import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getBookingRules,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getBookingRules():', () => {
  it('should return empty array if no booking rules', () => {
    const bookingRuleId = 'not_real';

    const results = getBookingRules({
      booking_rule_id: bookingRuleId,
    });

    expect(results).toHaveLength(0);
  });
});
