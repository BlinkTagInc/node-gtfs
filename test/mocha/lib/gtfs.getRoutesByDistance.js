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

describe('gtfs.getRoutesByDistance(): ', function(){

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
      closeDb: function(next) {
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

  it('should return error and empty array if no routes exists', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    },function(){
      var lon = -121.9867495;
      var lat = 37.38976166855;
      var radius = 100;
      gtfs.getRoutesByDistance(lat, lon, radius, function(err, res){
        should.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });

  it('should return error and empty array if no routes within given distance exists', function(done){
    var lon = -127.9867495;
    var lat = 40.38976166855;
    var radius = 100;
    gtfs.getRoutesByDistance(lat, lon, radius, function(err, res){
      should.exist(err);
      should.exist(res);
      res.should.have.length(0);
      done();
    });
  });



  it('should return expected routes within given distance if exists', function(done){
    var lon = -121.9867495;
    var lat = 37.38976166855;
    var radius = 2;
    var expectedRoutes = {
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

    gtfs.getRoutesByDistance(lat, lon, radius, function(err, routes){
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(4);

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

  it('should return expected routes within given distance (without specifying radius) if exists', function(done){
    var lon = -122.39797353744507;
    var lat = 37.7210684234136;
    var expectedRoutes = {
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
    gtfs.getRoutesByDistance(lat, lon, function(err, routes){
      should.not.exist(err);
      should.exist(routes);
      routes.should.have.length(4);

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
