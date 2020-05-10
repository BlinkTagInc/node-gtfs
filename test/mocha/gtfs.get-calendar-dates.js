/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarDates():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
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
      expectedCalendarDates.should.matchAny(calendarDate);
    });
  });

  it('should return only specific keys for expected calendar dates, sorted by date', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    const calendarDates = await gtfs.getCalendarDates({
      service_id: {
        $in: serviceIds
      }
    }, {
      _id: 0,
      service_id: 1,
      date: 1
    }, {
      sort: { date: 1 },
      lean: true
    });

    const expectedCalendarDates = [
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

    calendarDates.length.should.equal(4);
    expectedCalendarDates.should.match(calendarDates);
  });
});
