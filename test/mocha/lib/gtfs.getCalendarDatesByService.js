const async = require('async');
const should = require('should');

// libraries
const config = require('./../../config.json');
const gtfs = require('./../../../');
const importScript = require('../../../lib/import');

// test support
const databaseTestSupport = require('./../../support/database');

// setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getCalendarDatesByService(): ', () => {

  before((done) => {
    databaseTestSupport.connect(config, done);
  });

  after((done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      },
      closeDb: (next) => {
        databaseTestSupport.close(next);
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

      const expectedCalendarDates = [
        {
          service_id: 'WD_20120701',
          date: 20120903,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'WD_20120701',
          date: 20121122,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'WD_20120701',
          date: 20121225,
          exception_type: 2,
          agency_key: 'caltrain'
        },
        {
          service_id: 'WD_20120701',
          date: 20130101,
          exception_type: 2,
          agency_key: 'caltrain'
        }
      ];

      calendarDates.forEach((calendarDate) => {
        const calendarDateFormatted = calendarDate.toObject();
        delete calendarDateFormatted._id;
        expectedCalendarDates.should.matchAny(calendarDateFormatted);
      });

      done();
    });
  });
});
