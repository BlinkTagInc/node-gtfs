/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getCalendarDates():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no calendar dates exist', async () => {
    const serviceId = 'fake-service-id';

    const results = await gtfs.getCalendarDates({
      service_id: serviceId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected calendar dates', async () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = await gtfs.getCalendarDates({
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

    results.forEach(result => {
      expectedResults.should.matchAny(result);
    });
  });

  it('should return only specific keys for expected calendar dates, sorted by date', async () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = await gtfs.getCalendarDates({
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
