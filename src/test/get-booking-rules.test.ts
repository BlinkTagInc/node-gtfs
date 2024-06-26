import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getBookingRules } from '../index.ts';

beforeAll(async () => {
  openDb(config);
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb(config);
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
