// dependencies
var request = require('supertest');
var async = require('async');
var should = require('should');
var tk = require('timekeeper');
var timeReference = new Date();

// libraries
var config = require('./../../config');
var gtfs = require('./../../../');
var downloadScript = require('../../../scripts/download');

// test support
var databaseTestSupport = require('./../../support/database')(config);
var db;

// setup fixtures
var agenciesFixtures = [{ agency_key: 'caltrain', url: __dirname + '/../../fixture/caltrain_20120824_0333.zip'}];
config.agencies = agenciesFixtures;

describe('gtfs.getAgency(): ', function(){

  before(function(done){
    async.series({
      connectToDb: function(next){
        databaseTestSupport.connect(function(err, _db){
          db = _db;
          next();
        });
      },
      setupMockDate: function(next){
        tk.freeze(timeReference);
        next();
      }
    }, function(){
      done();
    });
  });

  after(function(done) {
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      },
      closeDb: function(next){
        databaseTestSupport.close(next);
      },
      resetMockDate: function(next){
        tk.reset();
        next();
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

  it('should return null if agency_key does not exist (no agency_id provided)', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    }, function(){
	  var agency_key = 'caltrain-NOT';
      gtfs.getAgency(agency_key, function(err, agencies) {
        should.not.exists(err);
        should.not.exists(agencies);
		
        done();
      });
    });
  });

  it('should return expected agency for agency_key (no agency_id provided)', function(done){
	var agency_key = 'caltrain';
    gtfs.getAgency(agency_key, function(err, agencies){
      should.not.exist(err);
      should.exist(agencies);

      var agency = agencies.toObject();

      agency.agency_key.should.equal('caltrain');
      agency.agency_id.should.equal('caltrain-ca-us');
      agency.agency_name.should.equal('Caltrain');
      agency.agency_url.should.equal('http://www.caltrain.com');
      agency.agency_timezone.should.equal('America/Los_Angeles');
      agency.agency_lang.should.equal('en');
      agency.agency_phone.should.equal('800-660-4287');

      // current fixture does not have fare url. update this if needed next time
      should.not.exist(agency.agency_fare_url);

      agency.agency_bounds.should.have.keys(['sw', 'ne']);
      agency.agency_bounds.sw.should.have.length(2);
      agency.agency_bounds.sw[0].should.eql(-122.406408);
      agency.agency_bounds.sw[1].should.eql(37.003084);
      agency.agency_bounds.ne.should.have.length(2);
      agency.agency_bounds.ne[0].should.eql(-121.567091);
      agency.agency_bounds.ne[1].should.eql(37.7764393371);

      agency.agency_center.should.have.length(2);
      agency.agency_center[0].should.eql(-121.9867495);
      agency.agency_center[1].should.eql(37.38976166855);

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });

  it('should return null if agency_key does not exist (agency_id provided)', function(done){
    async.series({
      teardownDatabase: function(next){
        databaseTestSupport.teardown(next);
      }
    }, function(){
	  var agency_key = 'caltrain-NOT';
	  var agency_id = 'caltrain-ca-us';
      gtfs.getAgency(agency_key, agency_id, function(err, agencies) {
        should.not.exists(err);
        should.not.exists(agencies);
		
        done();
      });
    });
  });

  it('should return expected agency for agency_key and agency_id', function(done){
	var agency_key = 'caltrain';
	var agency_id = 'caltrain-ca-us';
    gtfs.getAgency(agency_key, agency_id, function(err, agencies){
      should.not.exist(err);
      should.exist(agencies);

	  var agency = agencies.toObject();

      agency.agency_key.should.equal('caltrain');
      agency.agency_id.should.equal('caltrain-ca-us');
      agency.agency_name.should.equal('Caltrain');
      agency.agency_url.should.equal('http://www.caltrain.com');
      agency.agency_timezone.should.equal('America/Los_Angeles');
      agency.agency_lang.should.equal('en');
      agency.agency_phone.should.equal('800-660-4287');

      // current fixture does not have fare url. update this if needed next time
      should.not.exist(agency.agency_fare_url);

      agency.agency_bounds.should.have.keys(['sw', 'ne']);
      agency.agency_bounds.sw.should.have.length(2);
      agency.agency_bounds.sw[0].should.eql(-122.406408);
      agency.agency_bounds.sw[1].should.eql(37.003084);
      agency.agency_bounds.ne.should.have.length(2);
      agency.agency_bounds.ne[0].should.eql(-121.567091);
      agency.agency_bounds.ne[1].should.eql(37.7764393371);

      agency.agency_center.should.have.length(2);
      agency.agency_center[0].should.eql(-121.9867495);
      agency.agency_center[1].should.eql(37.38976166855);

      agency.date_last_updated.should.eql(timeReference.getTime());

      done();
    });
  });
  
});
