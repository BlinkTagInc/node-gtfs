/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getCalendarDates } from '../../index.js';

describe('getCalendarDates():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no calendar dates exist', () => {
    const serviceId = 'fake-service-id';

    const results = getCalendarDates({
      service_id: serviceId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected calendar dates', () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = getCalendarDates({
      service_id: serviceId,
    });

    should.exists(results);
    results.length.should.equal(4);

    const expectedResults = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
        exception_type: 2,
        holiday_name: null,
      },
    ];

    for (const result of results) {
      expectedResults.should.matchAny(result);
    }
  });

  it('should return only specific keys for expected calendar dates, sorted by date', () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = getCalendarDates(
      {
        service_id: serviceId,
      },
      ['service_id', 'date'],
      [
        ['date', 'ASC'],
        ['service_id', 'ASC'],
      ]
    );

    const expectedResults = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
      },
    ];

    results.length.should.equal(4);
    expectedResults.should.match(results);
  });
});
