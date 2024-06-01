/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getBookingRules } from '../../index.js';

describe('getBookingRules():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no booking rules', () => {
    const bookingRuleId = 'not_real';

    const results = getBookingRules({
      booking_rule_id: bookingRuleId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
