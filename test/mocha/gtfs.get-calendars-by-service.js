const path = require('path');

const async = require('async');
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

const agencyKey = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarsByService(): ', () => {
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
        gtfs.import(config, next);
      }
    }, done);
  });

  it('should return empty array if no calendars', done => {
    async.series({
      teardownDatabase: next => {
        database.teardown(next);
      }
    }, () => {
      const serviceIds = ['CT-16APR-Caltrain-Weekday-01-not-real'];

      gtfs.getCalendarsByService(serviceIds, (err, calendars) => {
        should.not.exists(err);
        should.exists(calendars);
        calendars.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected calendars', done => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];

    gtfs.getCalendarsByService(serviceIds, (err, calendars) => {
      should.not.exist(err);
      should.exist(calendars);
      calendars.length.should.equal(1);

      const calendar = calendars[0].toObject();

      calendar.agency_key.should.equal(agencyKey);
      calendar.service_id.should.equal('CT-16APR-Caltrain-Weekday-01');
      calendar.monday.should.equal(1);
      calendar.tuesday.should.equal(1);
      calendar.wednesday.should.equal(1);
      calendar.thursday.should.equal(1);
      calendar.friday.should.equal(1);
      calendar.saturday.should.equal(0);
      calendar.sunday.should.equal(0);
      calendar.start_date.should.equal(20160404);
      calendar.end_date.should.equal(20190331);

      done();
    });
  });
});
