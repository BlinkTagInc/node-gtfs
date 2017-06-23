const path = require('path');

const async = require('async');
const should = require('should');

// Libraries
const config = require('../config.json');
const gtfs = require('../../');


const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarDatesByService(): ', () => {
  before(done => {
    database.connect(config, done);
  });

  after(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      closeDb: next => {
        database.close(next);
      }
    }, done);
  });

  beforeEach(done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      },
      executeDownloadScript: next => {
        gtfs.import(config)
        .then(next)
        .catch(next);
      }
    }, done);
  });

  it('should return empty array if no calendar dates exist', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];
      gtfs.getCalendarDatesByService(serviceIds, (err, calendarDates) => {
        should.not.exists(err);
        should.exists(calendarDates);
        calendarDates.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected calendar dates', done => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];
    gtfs.getCalendarDatesByService(serviceIds, (err, calendarDates) => {
      should.not.exist(err);
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

      done();
    });
  });
});
