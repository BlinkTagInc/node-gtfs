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
  path: path.join(__dirname, '../fixture/caltrain_20120824_0333.zip')
}];

const agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesById(): ', () => {

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

  it('should return empty array if no route', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      const routeId = 'not_real';

      gtfs.getRoutesById(agency_key, routeId, (err, route) => {
        should.not.exists(err);
        should.not.exists(route);
        done();
      });
    });
  });

  it('should return expected route', (done) => {
    const routeId = 'ct_limited_20121001';

    gtfs.getRoutesById(agency_key, routeId, (err, route) => {
      should.not.exist(err);
      should.exist(route);

      route.agency_key.should.equal(agency_key);
      route.route_id.should.equal('ct_limited_20121001');
      route.route_short_name.should.equal('');
      route.route_long_name.should.equal('Limited');
      route.route_desc.should.equal('');
      route.route_type.should.equal(2);
      route.route_url.should.equal('');
      route.route_color.should.equal('FEF0B5');
      route.route_text_color.should.equal('');

      done();
    });
  });
});
