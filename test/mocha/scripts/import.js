const fs = require('fs');
const async = require('async');
const unzip = require('unzip2');
const parse = require('csv-parse');
const path = require('path');

const config = require('./../../config.json');
const importScript = require('../../../lib/import');

const agenciesFixturesUrl = [{
  agency_key: 'caltrain',
  url: 'http://transitfeeds.com/p/caltrain/122/latest/download'
}];

const agenciesFixturesLocal = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '/../../fixture/caltrain_20120824_0333.zip')
}];

const database = require('./../../support/database');

const filenames = require('../../../lib/filenames');

describe('lib/import.js', function testImport() {
  this.timeout(10000);
  describe('Download and import from different GTFS sources', () => {
    it('should be able to download and import from HTTP', (done) => {
      config.agencies = agenciesFixturesUrl;
      importScript(config, done);
    });

    it('should be able to download and import from local filesystem', (done) => {
      config.agencies = agenciesFixturesLocal;
      importScript(config, done);
    });
  });

  describe('Verify data imported into database', () => {
    config.agencies = agenciesFixturesLocal;

    const onError = (err) => {
      throw new Error('Test failed', err);
    };

    let db;
    const countData = {};
    const tmpDir = path.join(__dirname, '/../../fixture/tmp/');

    before((done) => {
      async.series({
        extractFixture: (next) => {
          const agencyPathFixture = agenciesFixturesLocal[0].path;
          fs.createReadStream(agencyPathFixture)
            .pipe(unzip.Extract({ path: tmpDir }).on('close', next).on('error', onError))
            .on('error', onError);
        },
        countRowsInGTFSFiles: (next) => {
          async.eachSeries(filenames, (file, next) => {
            const filePath = path.join(tmpDir, `${file.fileNameBase}.txt`);

            // GTFS has optional files
            if (!fs.existsSync(filePath)) {
              countData[file.collection] = 0;
              return next();
            }

            const parser = parse({ columns: true }, (err, data) => {
              countData[file.collection] = data.length;
              next();
            });

            return fs.createReadStream(filePath)
              .pipe(parser)
              .on('error', (err) => {
                onError(err);
                countData[file.collection] = 0;
                next();
              });
          }, next);
        },
        connectToDb: (next) => {
          database.connect(config, (err, client) => {
            db = client;
            next(err);
          });
        },
        teardownDatabase: (next) => {
          database.teardown(next);
        },
        executeDownloadScript: (next) => {
          importScript(config, next);
        }
      }, done);
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

    it('should import the same number of agencies', (done) => {
      db.collection('agencies').count((err, res) => {
        res.should.equal(countData.agencies);
        done();
      });
    });

    it('should import the same number of calendars', (done) => {
      db.collection('calendars').count((err, res) => {
        res.should.equal(countData.calendars);
        done();
      });
    });

    it('should import the same number of calendar_dates', (done) => {
      db.collection('calendardates').count((err, res) => {
        res.should.equal(countData.calendardates);
        done();
      });
    });

    it('should import the same number of fare_attributes', (done) => {
      db.collection('fareattributes').count((err, res) => {
        res.should.equal(countData.fareattributes);
        done();
      });
    });

    it('should import the same number of fare_rules', (done) => {
      db.collection('farerules').count((err, res) => {
        res.should.equal(countData.farerules);
        done();
      });
    });

    it('should import the same number of feed_info', (done) => {
      db.collection('feedinfos').count((err, res) => {
        res.should.equal(countData.feedinfos);
        done();
      });
    });

    it('should import the same number of frequencies', (done) => {
      db.collection('frequencies').count((err, res) => {
        res.should.equal(countData.frequencies);
        done();
      });
    });

    it('should import the same number of routes', (done) => {
      db.collection('routes').count((err, res) => {
        res.should.equal(countData.routes);
        done();
      });
    });

    it('should import the same number of shapes', (done) => {
      db.collection('shapes').count((err, res) => {
        res.should.equal(countData.shapes);
        done();
      });
    });

    it('should import the same number of stops', (done) => {
      db.collection('stops').count((err, res) => {
        res.should.equal(countData.stops);
        done();
      });
    });

    it('should import the same number of transfers', (done) => {
      db.collection('transfers').count((err, res) => {
        res.should.equal(countData.transfers);
        done();
      });
    });

    it('should import the same number of trips', (done) => {
      db.collection('trips').count((err, res) => {
        res.should.equal(countData.trips);
        done();
      });
    });
  });
});
