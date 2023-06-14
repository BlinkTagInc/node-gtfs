/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { parse } from 'csv-parse';
import should from 'should';

import {
  unzip,
  generateFolderName,
  prepDirectory,
} from '../../lib/file-utils.js';
import config from '../test-config.js';
import {
  openDb,
  closeDb,
  importGtfs,
  exportGtfs,
  getAgencies,
} from '../../index.js';
import models from '../../models/models.js';

describe('exportGtfs():', function () {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = openDb(config);
    closeDb(db);
  });

  this.timeout(10000);
  describe('Export GTFS', () => {
    it('should be able to export GTFS', async () => {
      await exportGtfs(config);
    });
  });

  describe('Verify data exported', () => {
    const countData = {};
    const temporaryDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixture/tmp/'
    );

    before(async () => {
      await prepDirectory(temporaryDir);
      await unzip(config.agencies[0].path, temporaryDir);

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

      await importGtfs(config);
    });

    after(async () => {
      const agencies = getAgencies({}, ['agency_name']);
      await rm(
        path.join(
          process.cwd(),
          'gtfs-export',
          generateFolderName(agencies[0].agency_name)
        ),
        { recursive: true, force: true }
      );
    });

    for (const model of models) {
      it(`should import the same number of ${model.filenameBase}`, async () => {
        const agencies = getAgencies({}, ['agency_name']);
        const filePath = path.join(
          process.cwd(),
          'gtfs-export',
          generateFolderName(agencies[0].agency_name),
          `${model.filenameBase}.txt`
        );

        // GTFS has optional files
        if (!existsSync(filePath)) {
          const result = 0;
          result.should.equal(countData[model.filenameBase]);
          return;
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

            should.not.exist(error);

            data.length.should.equal(countData[model.filenameBase]);
          }
        );

        return createReadStream(filePath)
          .pipe(parser)
          .on('error', (error) => {
            should.not.exist(error);
          });
      });
    }
  });
});
