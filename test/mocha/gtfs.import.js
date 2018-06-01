/* eslint-env mocha */

const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const extract = require('extract-zip');
const parse = require('csv-parse');
const mongoose = require('mongoose');
const should = require('should');

const extractAsync = promisify(extract);

const config = require('../config.json');
const gtfs = require('../..');
const models = require('../../models/models');

const agenciesFixturesUrl = [{
  agency_key: 'caltrain',
  url: 'http://transitfeeds.com/p/caltrain/122/latest/download'
}];

const agenciesFixturesLocal = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

describe('lib/import.js', function () {
  before(async () => {
    await mongoose.connect(config.mongoUrl);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  this.timeout(10000);
  describe('Download and import from different GTFS sources', () => {
    it('should be able to download and import from HTTP', async () => {
      await mongoose.connection.db.dropDatabase();
      config.agencies = agenciesFixturesUrl;
      await gtfs.import(config);
    });

    it('should be able to download and import from local filesystem', async () => {
      await mongoose.connection.db.dropDatabase();
      config.agencies = agenciesFixturesLocal;
      await gtfs.import(config);
    });
  });

  describe('Verify data imported into database', () => {
    config.agencies = agenciesFixturesLocal;

    const countData = {};
    const tmpDir = path.join(__dirname, '../fixture/tmp/');

    before(async () => {
      await extractAsync(agenciesFixturesLocal[0].path, {dir: tmpDir});

      await Promise.all(models.map(model => {
        const filePath = path.join(tmpDir, `${model.filenameBase}.txt`);

        // GTFS has optional files
        if (!fs.existsSync(filePath)) {
          countData[model.filenameBase] = 0;
          return false;
        }

        const parser = parse({
          columns: true,
          relax: true,
          trim: true
        }, (err, data) => {
          if (err) {
            throw new Error(err);
          }

          countData[model.filenameBase] = data.length;
        });

        return fs.createReadStream(filePath)
          .pipe(parser)
          .on('error', err => {
            countData[model.collection] = 0;
            throw new Error(err);
          });
      }));

      await mongoose.connection.db.dropDatabase();
      await gtfs.import(config);
    });

    for (const model of models) {
      it(`should import the same number of ${model.filenameBase}`, done => {
        model.model.collection.count((err, res) => {
          should.not.exist(err);
          res.should.equal(countData[model.filenameBase]);
          done();
        });
      });
    }
  });
});
