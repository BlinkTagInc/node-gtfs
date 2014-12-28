var fs = require('fs');
var async = require('async');
var unzip = require('unzip2');
var parse = require('csv-parse');

var config = require('./../../config');
var downloadScript = require('../../../scripts/download');
var agenciesFixtures = {
  http: [{ agency_key: 'caltrain', url:  'http://www.gtfs-data-exchange.com/agency/caltrain/latest.zip'}],
  local: [{ agency_key: 'caltrain', url: __dirname + '/../../fixture/caltrain_20120824_0333.zip'}]
};

var databaseTestSupport = require('./../../support/database')(config);

var GTFSFiles = require('../../support/GTFSFiles');

describe('script/download.js', function(){

  this.timeout(10000);

  describe('Download and import from different GTFS sources', function(){

    it('should be able to download and import from HTTP', function(done){
      config.agencies = agenciesFixtures.http;
      downloadScript(config, done);
    });

    it('should be able to download and import from local filesystem', function(done){
      config.agencies = agenciesFixtures.local;
      downloadScript(config, done);

    });

  });

  describe('Verify data imported into database', function(){

    config.agencies = agenciesFixtures.local;

    var onError = function(err){
      throw new Error('Test failed', err);
    };

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
          databaseTestSupport.connect(function(err, _db){
            db = _db;
            next();
          });
        },
        teardownDatabase: function(next){
          databaseTestSupport.teardown(next);
        },
        executeDownloadScript: function(next){
          downloadScript(config, next);
        }
      },function(){
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
