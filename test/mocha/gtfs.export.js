/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */

const path = require('path');
const fs = require('fs-extra');
const parse = require('csv-parse');
const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const { unzip } = require('../../lib/file-utils');
const gtfs = require('../..');
const models = require('../../models/models');

const config = {
  agencies: [{
    agency_key: 'caltrain',
    path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
  }],
  verbose: false
};

describe('lib/export.js', function () {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  this.timeout(10000);
  describe('Export GTFS', () => {
    it('should be able to export GTFS', async () => {
      await gtfs.export(config);
    });
  });

  describe('Verify data exported', () => {
    const countData = {};
    const temporaryDir = path.join(__dirname, '../fixture/tmp/');

    before(async () => {
      await unzip(config.agencies[0].path, temporaryDir);

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

    after(async () => {
      await fs.remove(path.join(process.cwd(), 'gtfs-export', config.agencies[0].agency_key));
    });

    for (const model of models) {
      it(`should import the same number of ${model.filenameBase}`, done => {
        const filePath = path.join(process.cwd(), 'gtfs-export', config.agencies[0].agency_key, `${model.filenameBase}.txt`);

        // GTFS has optional files
        if (!fs.existsSync(filePath)) {
          const result = 0;
          result.should.equal(countData[model.filenameBase]);
          return done();
        }

        const parser = parse({
          columns: true,
          relax: true,
          trim: true
        }, (error, data) => {
          if (error) {
            throw new Error(error);
          }

          should.not.exist(error);

          data.length.should.equal(countData[model.filenameBase]);
          done();
        });

        return fs.createReadStream(filePath)
          .pipe(parser)
          .on('error', error => {
            should.not.exist(error);
          });
      });
    }
  });
});
