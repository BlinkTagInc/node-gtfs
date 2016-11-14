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
const agency_id = agenciesFixtures[0].agency_id;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByAgency(): ', () => {

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

  it('should return empty array if no routes for given agency exists (agency_id not provided)', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      gtfs.getRoutesByAgency(agency_key, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected routes for given agency (agency_id not provided)', (done) => {
    gtfs.getRoutesByAgency(agency_key, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);

      const expectedRoutes = {
        ct_bullet_20120701: {
          route_id: 'ct_bullet_20120701',
          route_short_name: '',
          route_long_name: 'Bullet',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'E31837',
          route_text_color: '',
          agency_key: 'caltrain'
        },
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
          agency_key: 'caltrain'
        },
        ct_bullet_20121001: {
          route_id: 'ct_bullet_20121001',
          route_short_name: '',
          route_long_name: 'Bullet',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'E31837',
          route_text_color: '',
          agency_key: 'caltrain'
        },
        ct_limited_20121001: {
          route_id: 'ct_limited_20121001',
          route_short_name: '',
          route_long_name: 'Limited',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'FEF0B5',
          route_text_color: '',
          agency_key: 'caltrain'
        },
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

      routes.should.have.length(6);

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

  it('should return empty array if no routes for given agency exists (agency_id provided)', (done) => {
    async.series({
      teardownDatabase: (next) => {
        database.teardown(next);
      }
    }, () => {
      gtfs.getRoutesByAgency(agency_key, agency_id, (err, res) => {
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected routes for given agency and agency_id', (done) => {
    gtfs.getRoutesByAgency(agency_key, agency_id, (err, routes) => {
      should.not.exist(err);
      should.exist(routes);

      const expectedRoutes = {
        ct_bullet_20120701: {
          route_id: 'ct_bullet_20120701',
          route_short_name: '',
          route_long_name: 'Bullet',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'E31837',
          route_text_color: '',
          agency_key: 'caltrain'
        },
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
          agency_key: 'caltrain'
        },
        ct_bullet_20121001: {
          route_id: 'ct_bullet_20121001',
          route_short_name: '',
          route_long_name: 'Bullet',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'E31837',
          route_text_color: '',
          agency_key: 'caltrain'
        },
        ct_limited_20121001: {
          route_id: 'ct_limited_20121001',
          route_short_name: '',
          route_long_name: 'Limited',
          route_desc: '',
          route_type: 2,
          route_url: '',
          route_color: 'FEF0B5',
          route_text_color: '',
          agency_key: 'caltrain'
        },
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

      routes.should.have.length(6);

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
