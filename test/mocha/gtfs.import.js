const path = require('path');
const fs = require('fs');

const extract = require('extract-zip');
const parse = require('csv-parse');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const agenciesFixturesUrl = [{
  agency_key: 'caltrain',
  url: 'http://transitfeeds.com/p/caltrain/122/latest/download'
}];

const agenciesFixturesLocal = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

const database = require('../support/database');

const filenames = require('../../lib/filenames');

describe('lib/import.js', function () {
  this.timeout(10000);
  describe('Download and import from different GTFS sources', () => {
    it('should be able to download and import from HTTP', () => {
      config.agencies = agenciesFixturesUrl;
      return gtfs.import(config);
    });

    it('should be able to download and import from local filesystem', () => {
      config.agencies = agenciesFixturesLocal;
      return gtfs.import(config);
    });
  });

  describe('Verify data imported into database', () => {
    config.agencies = agenciesFixturesLocal;

    const onError = err => {
      throw new Error('Test failed', err);
    };

    let db;
    const countData = {};
    const tmpDir = path.join(__dirname, '../fixture/tmp/');

    before(() => {
      return new Promise((resolve, reject) => {
        extract(agenciesFixturesLocal[0].path, {dir: tmpDir}, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      })
      .then(() => {
        return Promise.all(filenames.map(file => {
          const filePath = path.join(tmpDir, `${file.fileNameBase}.txt`);

          // GTFS has optional files
          if (!fs.existsSync(filePath)) {
            countData[file.collection] = 0;
            return false;
          }

          const parser = parse({columns: true}, (err, data) => {
            if (err) {
              throw new Error(err);
            }

            countData[file.collection] = data.length;
          });

          return fs.createReadStream(filePath)
          .pipe(parser)
          .on('error', err => {
            countData[file.collection] = 0;
            throw new Error(err);
          });
        }));
      })
      .then(() => {
        return database.connect(config)
        .then(client => {
          db = client;
        });
      })
      .then(() => database.teardown())
      .then(() => gtfs.import(config))
    });

    after(() => {
      return database.teardown()
      .then(() => database.close());
    });

    it('should import the same number of agencies', done => {
      db.collection('agencies').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.agencies);
        done();
      });
    });

    it('should import the same number of calendars', done => {
      db.collection('calendars').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.calendars);
        done();
      });
    });

    it('should import the same number of calendar_dates', done => {
      db.collection('calendardates').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.calendardates);
        done();
      });
    });

    it('should import the same number of fare_attributes', done => {
      db.collection('fareattributes').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.fareattributes);
        done();
      });
    });

    it('should import the same number of fare_rules', done => {
      db.collection('farerules').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.farerules);
        done();
      });
    });

    it('should import the same number of feed_info', done => {
      db.collection('feedinfos').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.feedinfos);
        done();
      });
    });

    it('should import the same number of frequencies', done => {
      db.collection('frequencies').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.frequencies);
        done();
      });
    });

    it('should import the same number of routes', done => {
      db.collection('routes').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.routes);
        done();
      });
    });

    it('should import the same number of shapes', done => {
      db.collection('shapes').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.shapes);
        done();
      });
    });

    it('should import the same number of stops', done => {
      db.collection('stops').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.stops);
        done();
      });
    });

    it('should import the same number of transfers', done => {
      db.collection('transfers').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.transfers);
        done();
      });
    });

    it('should import the same number of trips', done => {
      db.collection('trips').count((err, res) => {
        should.not.exist(err);
        res.should.equal(countData.trips);
        done();
      });
    });
  });
});
