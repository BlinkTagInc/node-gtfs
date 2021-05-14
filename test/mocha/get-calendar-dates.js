/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getCalendarDates } from '../../index.js';

describe('getCalendarDates():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no calendar dates exist', async () => {
    const serviceId = 'fake-service-id';

    const results = await getCalendarDates({
      service_id: serviceId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected calendar dates', async () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = await getCalendarDates({
      service_id: serviceId
    });

    should.exists(results);
    results.length.should.equal(4);

    const expectedResults = [
      {
        id: 2,
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
        exception_type: 2,
        holiday_name: null
      },
      {
        id: 4,
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
        exception_type: 2,
        holiday_name: null
      },
      {
        id: 6,
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
        exception_type: 2,
        holiday_name: null
      },
      {
        id: 8,
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
        exception_type: 2,
        holiday_name: null
      }
    ];

    for (const result of results) {
      expectedResults.should.matchAny(result);
    }
  });

  it('should return only specific keys for expected calendar dates, sorted by date', async () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = await getCalendarDates({
      service_id: serviceId
    }, [
      'service_id',
      'date'
    ], [
      ['date', 'ASC'],
      ['service_id', 'ASC']
    ]);

    const expectedResults = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124
      }
    ];

    results.length.should.equal(4);
    expectedResults.should.match(results);
  });
});
