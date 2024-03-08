/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getCalendarAttributes,
} from '../../index.js';

describe('getCalendarAttributes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no calendar attributes', () => {
    const serviceId = 'fake-service-id';

    const results = getCalendarAttributes({
      service_id: serviceId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
