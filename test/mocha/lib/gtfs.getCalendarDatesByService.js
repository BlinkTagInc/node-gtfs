
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

describe('gtfs.getCalendarDatesByService(): ', () => {

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

  it('should return empty array if no calendar dates exist', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    }, () => {
      gtfs.getCalendarDatesByService(['WD_20120701'], (err, calendarDates) => {
        should.not.exists(err);
        should.exists(calendarDates);
        calendarDates.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected calendar dates', (done) => {
    gtfs.getCalendarDatesByService(['WD_20120701'], (err, calendarDates) => {
      should.not.exist(err);
      should.exist(calendarDates);
      calendarDates.length.should.equal(4);

      const calendarDate = calendarDates[0].toObject();

      calendarDate.agency_key.should.equal(agency_key);
      calendarDate.service_id.should.equal('WD_20120701');
      calendarDate.date.should.equal(20120903);
      calendarDate.exception_type.should.equal(2);

      done();
    });
  });
});
