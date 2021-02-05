/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */

const path = require('path');
const fs = require('fs');
const parse = require('csv-parse');
const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const { unzip } = require('../../lib/file-utils');
const config = require('../test-config.js');
const gtfs = require('../..');
const models = require('../../models/models');

let db;

const agenciesFixturesRemote = [{
  url: 'http://transitfeeds.com/p/caltrain/122/20160406/download'
}];

const agenciesFixturesLocal = [{
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

describe('lib/import.js', function () {
  before(async () => {
    db = await openDb(config);
  });

  after(async () => {
    await closeDb();
  });

  this.timeout(10000);
  describe('Download and import from different GTFS sources', () => {
    it('should be able to download and import from HTTP', async () => {
      config.agencies = agenciesFixturesRemote;
      await gtfs.import(config);

      const routes = await gtfs.getRoutes();
      should.exist(routes);
      routes.length.should.equal(4);
    });

    it('should be able to download and import from local filesystem', async () => {
      config.agencies = agenciesFixturesLocal;
      await gtfs.import(config);

      const routes = await gtfs.getRoutes();
      should.exist(routes);
      routes.length.should.equal(4);
    });
  });

  describe('Verify data imported into database', () => {
    config.agencies = agenciesFixturesLocal;

    const countData = {};
    const temporaryDir = path.join(__dirname, '../fixture/tmp/');

    before(async () => {
      await unzip(agenciesFixturesLocal[0].path, temporaryDir);

      await Promise.all(models.map(model => {
        const filePath = path.join(temporaryDir, `${model.filenameBase}.txt`);

        // GTFS has optional files
        if (!fs.existsSync(filePath)) {
          countData[model.filenameBase] = 0;
          return false;
        }

        const parser = parse({
          columns: true,
          relax: true,
          trim: true
        }, (error, data) => {
          if (error) {
            throw new Error(error);
          }

          countData[model.filenameBase] = data.length;
        });

        return fs.createReadStream(filePath)
          .pipe(parser)
          .on('error', error => {
            countData[model.collection] = 0;
            throw new Error(error);
          });
      }));

      await gtfs.import(config);
    });

    for (const model of models) {
      it(`should import the same number of ${model.filenameBase}`, async () => {
        const result = await db.get(`SELECT COUNT(*) FROM ${model.filenameBase};`);
        result['COUNT(*)'].should.equal(countData[model.filenameBase]);
      });
    }
  });
});
