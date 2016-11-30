const async = require('async');
const path = require('path');
const should = require('should');

// libraries
const config = require('../config.json');
const gtfs = require('../../');


// test support
const database = require('../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendars(): ', () => {

  before((done) => {
    database.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      closeDb: (next) => {
        database.close(next);
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      },
      executeDownloadScript: (next) => {
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return empty array if no calendars', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      const startDate = 20160404;
      const endDate = 20160405;
      const monday = 1;
      const tuesday = 1;
      const wednesday = 1;
      const thursday = 1;
      const friday = 1;
      const saturday = 1;
      const sunday = 1;

      gtfs.getCalendars(agency_key, startDate, endDate, monday, tuesday, wednesday, thursday, friday, saturday, sunday, (err, calendars) => {
        should.not.exists(err);
        should.exists(calendars);
        calendars.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected calendars', (done) => {
    const startDate = 20160404;
    const endDate = 20160405;
    const monday = 0;
    const tuesday = 1;
    const wednesday = 0;
    const thursday = 0;
    const friday = 0;
    const saturday = 0;
    const sunday = 0;

    gtfs.getCalendars(agency_key, startDate, endDate, monday, tuesday, wednesday, thursday, friday, saturday, sunday, (err, calendars) => {
      should.not.exist(err);
      should.exist(calendars);
      calendars.length.should.equal(1);

      const expectedCalendar = {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 0,
        sunday: 0,
        start_date: 20160404,
        end_date: 20190331,
        agency_key: 'caltrain'
      };

      const calendarFormatted = calendars[0].toObject();
      delete calendarFormatted._id;
      expectedCalendar.should.match(calendarFormatted);

      done();
    });
  });
});
