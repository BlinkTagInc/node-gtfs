
const async = require('async');
const should = require('should');
const tk = require('timekeeper');
const timeReference = new Date();

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database')(config);
let db;

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendars(): ', () => {

  before((done) => {
    async.series({
      connectToDb: (next) => {
        databaseTestSupport.connect((err, _db) => {
          db = _db;
          next();
        });
      },
      setupMockDate: (next) => {
        tk.freeze(timeReference);
        next();
      }
    }, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
      },
      resetMockDate: (next) => {
        tk.reset();
        next();
      }
    }, done);
  });

  beforeEach((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      executeDownloadScript: (next) => {
        importScript(config, next);
      }
    }, done);
  });

  it('should return empty array if no calendars', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    }, () => {
      const startDate = 20110701;
      const endDate = 20110801;
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
    const startDate = 20121005;
    const endDate = 20121101;
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

      const calendar = calendars[0].toObject();

      calendar.agency_key.should.equal(agency_key);
      calendar.service_id.should.equal('WD_20121001');
      calendar.monday.should.equal(1);
      calendar.tuesday.should.equal(1);
      calendar.wednesday.should.equal(1);
      calendar.thursday.should.equal(1);
      calendar.friday.should.equal(1);
      calendar.saturday.should.equal(0);
      calendar.sunday.should.equal(0);
      calendar.start_date.should.equal(20121001);
      calendar.end_date.should.equal(20131001);

      done();
    });
  });
});
