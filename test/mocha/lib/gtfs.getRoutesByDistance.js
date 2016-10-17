
const async = require('async');
const should = require('should');

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

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByDistance(): ', () => {

  before((done) => {
    async.series({
      connectToDb: (next) => {
        databaseTestSupport.connect((err, _db) => {
          db = _db;
          next();
        });
      }
    }, done)
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

  it('should return an empty array if no routes exist', (done) => {
    async.series({
      teardownDatabase: (next) => {
        databaseTestSupport.teardown(next);
      }
    }, () => {
      const lon = -121.9867495;
      const lat = 37.38976166855;
      const radius = 100;

      gtfs.getRoutesByDistance(lat, lon, radius, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return an empty array if no routes within given distance exist', (done) => {
    const lon = -127.9867495;
    const lat = 40.38976166855;
    const radius = 100;

    gtfs.getRoutesByDistance(lat, lon, radius, (err, res) => {
      should.not.exist(err);
      should.exist(res);
      res.should.have.length(0);
      done();
    });
  });



  it('should return expected routes within given distance if they exist', (done) => {
    const lon = -121.9867495;
    const lat = 37.38976166855;
    const radius = 2;
    const expectedRoutes = {
      ct_limited_20120701: {
        route_id: 'ct_limited_20120701',
        route_short_name: '',
        route_long_name: 'Limited',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: 'FEF0B5',
        route_text_color: '',
        agency_key: 'caltrain'
      },
      ct_local_20120701: {
        route_id: 'ct_local_20120701',
        route_short_name: '',
        route_long_name: 'Local',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: '',
        route_text_color: '',
        agency_key: 'caltrain'},
      ct_limited_20121001: {
        route_id: 'ct_limited_20121001',
        route_short_name: '',
        route_long_name: 'Limited',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: 'FEF0B5',
        route_text_color: '',
        agency_key: 'caltrain'},
      ct_local_20121001: {
        route_id: 'ct_local_20121001',
        route_short_name: '',
        route_long_name: 'Local',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: '',
        route_text_color: '',
        agency_key: 'caltrain'
      }
    };

    gtfs.getRoutesByDistance(lat, lon, radius, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(4);

      routes.forEach((route) => {
        const expectedRoute = expectedRoutes[route.route_id];

        should.exist(expectedRoute);
        route.route_id.should.equal(expectedRoute.route_id);
        route.route_short_name.should.equal(expectedRoute.route_short_name);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_desc.should.equal(expectedRoute.route_desc);
        route.route_type.should.equal(expectedRoute.route_type);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_url.should.equal(expectedRoute.route_url);
        route.route_color.should.equal(expectedRoute.route_color);
        route.route_text_color.should.equal(expectedRoute.route_text_color);
        route.agency_key.should.equal(expectedRoute.agency_key);
      });
      done();
    });
  });

  it('should return expected routes within given distance (without specifying radius) if exists', (done) => {
    const lon = -122.39797353744507;
    const lat = 37.7210684234136;
    const expectedRoutes = {
      ct_limited_20120701: {
        route_id: 'ct_limited_20120701',
        route_short_name: '',
        route_long_name: 'Limited',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: 'FEF0B5',
        route_text_color: '',
        agency_key: 'caltrain'
      },
      ct_local_20120701: {
        route_id: 'ct_local_20120701',
        route_short_name: '',
        route_long_name: 'Local',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: '',
        route_text_color: '',
        agency_key: 'caltrain'},
      ct_limited_20121001: {
        route_id: 'ct_limited_20121001',
        route_short_name: '',
        route_long_name: 'Limited',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: 'FEF0B5',
        route_text_color: '',
        agency_key: 'caltrain'},
      ct_local_20121001: {
        route_id: 'ct_local_20121001',
        route_short_name: '',
        route_long_name: 'Local',
        route_desc: '',
        route_type: 2,
        route_url: '',
        route_color: '',
        route_text_color: '',
        agency_key: 'caltrain'
      }
    };
    gtfs.getRoutesByDistance(lat, lon, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(4);

      routes.forEach((route) => {
        const expectedRoute = expectedRoutes[route.route_id];

        should.exist(expectedRoute);
        route.route_id.should.equal(expectedRoute.route_id);
        route.route_short_name.should.equal(expectedRoute.route_short_name);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_desc.should.equal(expectedRoute.route_desc);
        route.route_type.should.equal(expectedRoute.route_type);
        route.route_long_name.should.equal(expectedRoute.route_long_name);
        route.route_url.should.equal(expectedRoute.route_url);
        route.route_color.should.equal(expectedRoute.route_color);
        route.route_text_color.should.equal(expectedRoute.route_text_color);
        route.agency_key.should.equal(expectedRoute.agency_key);
      });
      done();
    });
  });
});
