/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */

import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import should from 'should';

import { prepDirectory, unzip } from '../../lib/file-utils.js';
import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  getRoutes,
  getStops,
} from '../../index.js';
import models from '../../models/models.js';

let db;

const agenciesFixturesRemote = [
  {
    url: 'http://transitfeeds.com/p/caltrain/122/20160406/download',
  },
];

const agenciesFixturesLocal = [
  {
    path: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixture/caltrain_20160406.zip'
    ),
  },
];

describe('importGtfs():', function () {
  before(() => {
    db = openDb(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  this.timeout(10000);
  describe('Download and import from different GTFS sources', () => {
    it('should be able to download and import from HTTP', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesRemote,
      });

      const routes = getRoutes();
      should.exist(routes);
      routes.length.should.equal(4);
    });

    it('should be able to download and import from local filesystem', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesLocal,
      });

      const routes = getRoutes();
      should.exist(routes);
      routes.length.should.equal(4);
    });

    it("should throw an error when importing from local filesystem which doesn't exist", async () =>
      importGtfs({
        ...config,
        agencies: [
          {
            path: '/does/not/exist',
          },
        ],
      }).should.be.rejected());

    it('should add a prefix to imported data if present in config', async () => {
      const prefix = 'test-prefix';
      await importGtfs({
        ...config,
        agencies: [
          {
            ...agenciesFixturesLocal[0],
            prefix,
          },
        ],
      });

      const routes = getRoutes();
      should.exist(routes);
      routes[0].route_id.should.startWith(prefix);

      const stops = getStops();
      should.exist(stops);
      stops[0].stop_id.should.startWith(prefix);
    });
  });

  describe('Verify data imported into database', () => {
    const countData = {};
    const temporaryDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixture/tmp/'
    );

    before(async () => {
      await prepDirectory(temporaryDir);
      await unzip(agenciesFixturesLocal[0].path, temporaryDir);

      await Promise.all(
        models.map((model) => {
          const filePath = path.join(temporaryDir, `${model.filenameBase}.txt`);

          // GTFS has optional files
          if (!existsSync(filePath)) {
            countData[model.filenameBase] = 0;
            return false;
          }

          const parser = parse(
            {
              columns: true,
              relax_quotes: true,
              trim: true,
              skip_empty_lines: true,
            },
            (error, data) => {
              if (error) {
                throw new Error(error);
              }

              countData[model.filenameBase] = data.length;
            }
          );

          return createReadStream(filePath)
            .pipe(parser)
            .on('error', (error) => {
              countData[model.collection] = 0;
              throw new Error(error);
            });
        })
      );

      await importGtfs({
        ...config,
        agencies: agenciesFixturesLocal,
      });
    });

    for (const model of models) {
      it(`should import the same number of ${model.filenameBase}`, async () => {
        const result = await db
          .prepare(`SELECT COUNT(*) FROM ${model.filenameBase};`)
          .get();
        result['COUNT(*)'].should.equal(countData[model.filenameBase]);
      });
    }
  });
});
