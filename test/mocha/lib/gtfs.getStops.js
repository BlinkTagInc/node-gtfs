// dependencies
var async = require('async');
var should = require('should');

// libraries
var config = require('./../../config.json');
var gtfs = require('./../../../');
var importScript = require('../../../lib/import');

// test support
var databaseTestSupport = require('./../../support/database')(config);
var db;

// setup fixtures
var agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStops(): ', function(){

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
        importScript(config, next);
      }
    }, function(err, res){
      done();
    });
  });

  it('should return an empty array if no stops exists for given agency', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    },function(){
      var agency_key = 'non_existing_agency';
      gtfs.getStops(agency_key, function(err, stops){
        should.exist(stops);
        stops.should.have.length(0);
        done();
      });
    });
  });

  it('should return array of stops if it exists for given agency', function(done){
    var agency_key = 'caltrain';

    var expectedStopIds = [
      'Morgan Hill Caltrain',
      'Mountain View Caltrain',
      'Palo Alto Caltrain',
      'Redwood City Caltrain',
      'San Antonio Caltrain',
      'San Bruno Caltrain',
      'San Carlos Caltrain',
      'San Francisco Caltrain',
      'San Jose Caltrain',
      'San Martin Caltrain',
      'San Mateo Caltrain',
      'Santa Clara Caltrain',
      'So. San Francisco Caltrain',
      'Sunnyvale Caltrain',
      'Tamien Caltrain',
      '22nd Street Caltrain',
      'Atherton Caltrain',
      'Bayshore Caltrain',
      'Belmont Caltrain',
      'Blossom Hill Caltrain',
      'Burlingame Caltrain',
      'Broadway Caltrain',
      'California Ave Caltrain',
      'Capitol Caltrain',
      'College Park Caltrain',
      'Gilroy Caltrain',
      'Hayward Park Caltrain',
      'Hillsdale Caltrain',
      'Lawrence Caltrain',
      'Menlo Park Caltrain',
      'Millbrae Caltrain'
    ];

    gtfs.getStops(agency_key, function(err, stops){
      should.not.exist(err);
      should.exist(stops);

      stops.should.have.length(31);
      done();
    });
  });

  it('should return array of stops if it exists for given agency, and stop_ids', function(done){
    var agency_key = 'caltrain';
    var stop_ids = [
      'Burlingame Caltrain',
      '22nd Street Caltrain'
    ];

    gtfs.getStops(agency_key, stop_ids, function(err, stops){
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(2);
      done();
    });
  });
});
