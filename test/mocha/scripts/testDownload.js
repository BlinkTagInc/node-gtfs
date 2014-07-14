var fs = require('fs');
var request = require('supertest');
var async = require('async');
var should = require('should');
var unzip = require('unzip');
var parse = require('csv-parse');

var config = require('./../../config');
var downloadScript = require('../../../scripts/download');

var agenciesFixtures = {
  http: [{ agency_key: 'caltrain', url:  'http://www.gtfs-data-exchange.com/agency/caltrain/latest.zip'}],
  local: [{ agency_key: 'caltrain', url: __dirname + '/../../fixture/caltrain_20120824_0333.zip'}]
};

// taken from script/download.js
// TODO: make it available as an export?
var GTFSFiles = [
  {
    fileNameBase: 'agency'
    , collection: 'agencies'
  },
  {
    fileNameBase: 'calendar_dates'
    , collection: 'calendardates'
  },
  {
    fileNameBase: 'calendar'
    , collection: 'calendars'
  },
  {
    fileNameBase: 'fare_attributes'
    , collection: 'fareattributes'
  },
  {
    fileNameBase: 'fare_rules'
    , collection: 'farerules'
  },
  {
    fileNameBase: 'feed_info'
    , collection: 'feedinfos'
  },
  {
    fileNameBase: 'frequencies'
    , collection: 'frequencies'
  },
  {
    fileNameBase: 'routes'
    , collection: 'routes'
  },
  {
    fileNameBase: 'shapes'
    , collection: 'shapes'
  },
  {
    fileNameBase: 'stop_times'
    , collection: 'stoptimes'
  },
  {
    fileNameBase: 'stops'
    , collection: 'stops'
  },
  {
    fileNameBase: 'transfers'
    , collection: 'transfers'
  },
  {
    fileNameBase: 'trips'
    , collection: 'trips'
  }
];

describe('GTFS Feed Download', function(){

  this.timeout(5000);

  describe('Download from different GTFS sources', function(){

    it('should be able to download from HTTP', function(done){
      config.agencies = agenciesFixtures.http;
      downloadScript(config, function(){
        done();
      });
    });

    it('should be able to download from local filesystem', function(done){
      config.agencies = agenciesFixtures.local;
      downloadScript(config, function(){
        done();
      });
    });

  });

  describe('Verify data imported into database', function(){

    config.agencies = agenciesFixtures.local;

    var onError = function(err){
      throw new Error('Test failed', err);
    };

    // TODO: update when we move to agnostic db implementation
    var mongodb = require('mongodb');
    var db;
    var countData = {};
    var tmpDir = __dirname + '/../../fixture/tmp/';

    before(function(done) {
      async.series({
        extractFixture: function(next){
          var agency_url_fixture =  agenciesFixtures.local[0].url;
          fs.createReadStream(agency_url_fixture)
            .pipe(unzip.Extract({ path:  tmpDir}).on('close', next).on('error', onError))
            .on('error', onError);
        },
        countRowsInGTFSFiles: function(next){
          async.eachSeries(GTFSFiles, function(file, next){
            var path = [tmpDir, file.fileNameBase, '.txt'].join('');

            // GTFS has optional files
            if (!fs.existsSync(path)) {
              countData[file.collection] = 0;
              return next();
            }

            var parser = parse({columns: true}, function(err, data){
              countData[file.collection] = data.length;
              next();
            });

            fs.createReadStream(path)
              .pipe(parser)
              .on('error', function(err){
                onError(err);
                countData[file.collection] = 0;
                next();
              });

          }, function(err){
            next();
          });
        },
        connectToDb: function(next){
          mongodb.Db.connect(config.mongo_url, {w: 1}, function(err, _db) {
            db = _db;
            next();
          });
        },
        executeDownloadScript: function(next){
          downloadScript(config, function(){
            next();
          });
        }
      },function(){
        done();
      });
    });

    after(function(done) {
      async.series({
        closeDb: function(next){
          db.close();
          next();
        }
      },function(err, results){
        done();
      });
    });

    it('should import the same number of agencies', function(done){
      db.collection('agencies').count(function(err, res){
        res.should.equal(countData.agencies);
        done();
      });
    });

    it('should import the same number of calendars', function(done){
      db.collection('calendars').count(function(err, res){
        res.should.equal(countData.calendars);
        done();
      });
    });

    it('should import the same number of calendar_dates', function(done){
      db.collection('calendardates').count(function(err, res){
        res.should.equal(countData.calendardates);
        done();
      });
    });

    it('should import the same number of fare_attributes', function(done){
      db.collection('fareattributes').count(function(err, res){
        res.should.equal(countData.fareattributes);
        done();
      });
    });

    it('should import the same number of fare_rules', function(done){
      db.collection('farerules').count(function(err, res){
        res.should.equal(countData.farerules);
        done();
      });
    });

    it('should import the same number of feed_info', function(done){
      db.collection('feedinfos').count(function(err, res){
        res.should.equal(countData.feedinfos);
        done();
      });
    });

    it('should import the same number of frequencies', function(done){
      db.collection('frequencies').count(function(err, res){
        res.should.equal(countData.frequencies);
        done();
      });
    });

    it('should import the same number of routes', function(done){
      db.collection('routes').count(function(err, res){
        res.should.equal(countData.routes);
        done();
      });
    });

    it('should import the same number of shapes', function(done){
      db.collection('shapes').count(function(err, res){
        res.should.equal(countData.shapes);
        done();
      });
    });

    it('should import the same number of stops', function(done){
      db.collection('stops').count(function(err, res){
        res.should.equal(countData.stops);
        done();
      });
    });

    it('should import the same number of transfers', function(done){
      db.collection('transfers').count(function(err, res){
        res.should.equal(countData.transfers);
        done();
      });
    });

    it('should import the same number of trips', function(done){
      db.collection('trips').count(function(err, res){
        res.should.equal(countData.trips);
        done();
      });
    });

  });

});