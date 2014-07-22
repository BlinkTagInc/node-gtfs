// dependencies
var async = require('async');
var should = require('should');
var _ = require('underscore');

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

describe('gtfs.getStopsByRoute(): ', function(){

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

  it('should return error and empty array if no stops exists for given agency, route and direction', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    },function(){
      var agency_key = 'non_existing_agency';
      var route_id = 'non_existing_route_id';
      var direction_id = '0';
      gtfs.getStopsByRoute(agency_key, route_id, direction_id, function(err, stops){
        should.exist(err);
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops if it exists for given agency, route and direction', function(done){
    var agency_key = 'caltrain';
    var route_id = 'ct_local_20120701';
    var direction_id = '0';

    var expectedStopIds = [
      'San Jose Caltrain',
      'Santa Clara Caltrain',
      'Lawrence Caltrain',
      'Sunnyvale Caltrain',
      'Mountain View Caltrain',
      'San Antonio Caltrain',
      'California Ave Caltrain',
      'Palo Alto Caltrain',
      'Menlo Park Caltrain',
      'Atherton Caltrain',
      'Redwood City Caltrain',
      'San Carlos Caltrain',
      'Belmont Caltrain',
      'Hillsdale Caltrain',
      'Hayward Park Caltrain',
      'San Mateo Caltrain',
      'Burlingame Caltrain',
      'Broadway Caltrain',
      'Millbrae Caltrain',
      'San Bruno Caltrain',
      'So. San Francisco Caltrain',
      'Bayshore Caltrain',
      '22nd Street Caltrain',
      'San Francisco Caltrain'
    ];

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, function(err, stops){
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(24);

      for (var i in stops){
        var stop = stops[i];
        expectedStopIds[i].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      }
      done();
    });
  });

  it('should return array of stops if it exists for given agency, route and direction (opposite direction)', function(done){
    var agency_key = 'caltrain';
    var route_id = 'ct_local_20120701';
    var direction_id = '1';

    var expectedStopIds = [
      'San Francisco Caltrain',
      '22nd Street Caltrain',
      'Bayshore Caltrain',
      'So. San Francisco Caltrain',
      'San Bruno Caltrain',
      'Millbrae Caltrain',
      'Burlingame Caltrain',
      'San Mateo Caltrain',
      'Hayward Park Caltrain',
      'Hillsdale Caltrain',
      'Belmont Caltrain',
      'San Carlos Caltrain',
      'Redwood City Caltrain',
      'Menlo Park Caltrain',
      'Palo Alto Caltrain',
      'California Ave Caltrain',
      'San Antonio Caltrain',
      'Mountain View Caltrain',
      'Sunnyvale Caltrain',
      'Lawrence Caltrain',
      'Santa Clara Caltrain',
      'College Park Caltrain',
      'San Jose Caltrain',
      'Tamien Caltrain',
      'Capitol Caltrain',
      'Blossom Hill Caltrain',
      'Morgan Hill Caltrain',
      'San Martin Caltrain',
      'Gilroy Caltrain'
    ];

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, function(err, stops){
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(29);

      for (var i in stops){
        var stop = stops[i];
        expectedStopIds[i].should.equal(stop.stop_id, 'The order of stops are expected to be the same');
      }
      done();
    });
  });

  it('should return array of stops if it exists for given agency, route (without specifying direction)', function(done){
    var agency_key = 'caltrain';
    var route_id = 'ct_local_20120701';

    gtfs.getStopsByRoute(agency_key, route_id, function(err, stops){
      should.not.exist(err);
      should.exist(stops);

      // defer writing a test until we figure this out
      // this api is supposed to map to endpoint: /api/stops/:agency/:route_id
      // naturally, it should return stops for all directions like so
      // [
      //    {direction_id: 0, stops: [stop1, stop2, ...]},
      //    {direction_id: 1, stops: [stopX, stopW, ...]}
      // ]
      // Submitted an issue @ github: https://github.com/brendannee/node-gtfs/issues/19

      should.equal(0,1,'Not specifying direction_id does not return ALL stops (it should be the same as specifying ALL direction ids)');
      done();

    });
  });

});