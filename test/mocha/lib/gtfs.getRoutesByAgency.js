// dependencies
var async = require('async');
var should = require('should');

// libraries
var config = require('./../../config');
var gtfs = require('./../../../');
var downloadScript = require('../../../scripts/download');

// test support
var databaseTestSupport = require('./../../support/database')(config);
var db;

// setup fixtures
var agenciesFixtures = [{ agency_key: 'caltrain', url: __dirname + '/../../fixture/caltrain_20120824_0333.zip'}];
var agency_key = agenciesFixtures[0].agency_key;

config.agencies = agenciesFixtures;

describe('gtfs.getRoutesByAgency(): ', function(){

  before(function(done){
    async.series({
      connectToDb: function(next){
        databaseTestSupport.connect(function(err, _db){
          db = _db;
          next();
        });
      }
    }, function(){
      done();
    })
  });

  after(function(done) {
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      },
      closeDb: function(next){
        databaseTestSupport.close(next);
      }
    }, function(){
      done();
    });
  });

  beforeEach(function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      },
      executeDownloadScript: function(next){
        downloadScript(config, next);
      }
    }, function(err, res){
      done();
    });
  });

  it('should return empty array if no routes for given agency exists', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    }, function(){
      gtfs.getRoutesByAgency(agency_key, function(err, res){
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return expected routes for given agency', function(done){
    gtfs.getRoutesByAgency(agency_key,function(err, routes){
      should.not.exist(err);
      should.exist(routes);

      var expectedRoutes = {
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

      for (var i in routes){
        var route = routes[i];
        var expectedRoute = expectedRoutes[route.route_id];

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
      }

      done();
    });
  });
});
