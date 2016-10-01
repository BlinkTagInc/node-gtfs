// dependencies
var async = require('async');
var should = require('should');

// libraries
var config = require('./../../config.json');
var gtfs = require('./../../../');
var importScript = require('../../../scripts/import');

// test support
var databaseTestSupport = require('./../../support/database')(config);
var db;

// setup fixtures
var agenciesFixtures = [{
  agency_key: 'caltrain',
  path: __dirname + '/../../fixture/caltrain_20120824_0333.zip'
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsByDistance(): ', function(){

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
//        next();
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

  it('should return an empty array if no stops exist', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    }, function() {
      var lon = -121.9867495;
      var lat = 37.38976166855;
      var radius = 100;
      gtfs.getStopsByDistance(lat, lon, radius, function(err, res){
        should.not.exist(err);
        should.exist(res);
        res.should.have.length(0);
        done();
      });
    });
  });


  it('should return expected stops within given distance if they exist', function(done){
    var lon = -121.9867495;
    var lat = 37.38976166855;
    var radius = 2;
    var expectedStops = {
      'Lawrence Caltrain': {
        loc: [ -121.996982, 37.371578 ],
        agency_key: 'caltrain',
        stop_url: '',
        zone_id: '4',
        stop_lon: -121.996982,
        stop_lat: 37.371578,
        stop_desc: '137 San Zeno Way, Sunnyvale',
        stop_name: 'Lawrence Caltrain Station',
        stop_id: 'Lawrence Caltrain'
      }
    };

    gtfs.getStopsByDistance(lat, lon, radius, function(err, stops){
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(1);

      for (var i in stops){
        var stop = stops[i];
        var expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_desc.should.equal(expectedStop.stop_desc);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.agency_key.should.equal(expectedStop.agency_key);

      }
      done();
    });
  });

  it('should return expected stops within given distance (without specifying radius) if they exist', function(done){
    var lon = -121.915671;
    var lat = 37.340902;
    var expectedStops = {
      'College Park Caltrain': {
        loc: [ -121.914998, 37.34217 ],
        agency_key: 'caltrain',
        stop_url: '',
        zone_id: '4',
        stop_lon: -121.914998,
        stop_lat: 37.34217,
        stop_desc: '780 Stockton Avenue,San Jose',
        stop_name: 'College Park Caltrain Station',
        stop_id: 'College Park Caltrain'
      }
    };

    gtfs.getStopsByDistance(lat, lon, function(err, stops){
      should.not.exist(err);
      should.exist(stops);
      stops.should.have.length(1);

      for (var i in stops){
        var stop = stops[i];
        var expectedStop = expectedStops[stop.stop_id];

        should.exist(expectedStop);
        stop.stop_id.should.equal(expectedStop.stop_id);
        stop.stop_name.should.equal(expectedStop.stop_name);
        stop.stop_desc.should.equal(expectedStop.stop_desc);
        stop.stop_lat.should.equal(expectedStop.stop_lat);
        stop.stop_lon.should.equal(expectedStop.stop_lon);
        stop.stop_url.should.equal(expectedStop.stop_url);
        stop.agency_key.should.equal(expectedStop.agency_key);
      }
      done();
    });
  });
});
