const path = require('path');

const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarDates():', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return empty array if no calendar dates exist', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01-No'];

    const calendarDates = await gtfs.getCalendarDates({
      service_id: {
        $in: serviceIds
      }
    });
    should.exists(calendarDates);
    calendarDates.should.have.length(0);
  });

  it('should return expected calendar dates', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    const calendarDates = await gtfs.getCalendarDates({
      service_id: {
        $in: serviceIds
      }
    });

    should.exist(calendarDates);
    calendarDates.length.should.equal(4);

    const expectedCalendarDates = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
        exception_type: 2,
        agency_key: 'caltrain'
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
        exception_type: 2,
        agency_key: 'caltrain'
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
        exception_type: 2,
        agency_key: 'caltrain'
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
        exception_type: 2,
        agency_key: 'caltrain'
      }
    ];

    calendarDates.forEach(calendarDate => {
      const calendarDateFormatted = calendarDate.toObject();
      delete calendarDateFormatted._id;
      expectedCalendarDates.should.matchAny(calendarDateFormatted);
    });
  });
});
