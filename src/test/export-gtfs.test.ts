import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { parse } from 'csv-parse';
import { temporaryDirectory } from 'tempy';

import { unzip, generateFolderName, prepDirectory } from '../lib/file-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  exportGtfs,
  getAgencies,
} from '../index.ts';
import * as models from '../models/models.ts';
import { Model } from '../types/global_interfaces.ts';

describe('exportGtfs():', function () {
  describe('Export GTFS', () => {
    beforeEach(async () => {
      openDb();
      await importGtfs(config);
    });

    afterEach(async () => {
      const db = openDb();
      closeDb(db);
    });

    it('should be able to export GTFS', async () => {
      await exportGtfs(config);
    });
  });

  describe('Verify data exported', () => {
    const countData: {
      [key: string]: any;
    } = {};
    const temporaryDir = temporaryDirectory();

    beforeAll(async () => {
      await prepDirectory(temporaryDir);
      await unzip(config.agencies[0].path, temporaryDir);

      await Promise.all(
        Object.values(models).map((model: Model) => {
          const filePath = path.join(
            temporaryDir,
            `${model.filenameBase}.${model.filenameExtension}`,
          );

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
                throw error;
              }

              countData[model.filenameBase] = data.length;
            },
          );

          return createReadStream(filePath)
            .pipe(parser)
            .on('error', (error) => {
              countData[model.filenameBase] = 0;
              throw error;
            });
        }),
      );

      await importGtfs(config);
    });

    afterAll(async () => {
      openDb();
      const agencies = getAgencies({}, ['agency_name']);
      await rm(
        path.join(
          process.cwd(),
          'gtfs-export',
          generateFolderName(agencies[0].agency_name),
        ),
        { recursive: true, force: true },
      );

      await rm(temporaryDir, { recursive: true, force: true });
    });

    const modelsToValidate: Model[] = Object.values(models).filter(
      (model: Model) => model.extension !== 'gtfs-realtime',
    );

    for (const model of modelsToValidate) {
      it(`should import the same number of ${model.filenameBase}`, async () => {
        const agencies = getAgencies({}, ['agency_name']);
        const filePath = path.join(
          process.cwd(),
          'gtfs-export',
          generateFolderName(agencies[0].agency_name),
          `${model.filenameBase}.${model.filenameExtension}`,
        );

        // GTFS has optional files
        if (!existsSync(filePath)) {
          expect(countData[model.filenameBase]).toEqual(0);
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
              throw error;
            }

            expect(data).toHaveLength(countData[model.filenameBase]);
          },
        );

        return createReadStream(filePath)
          .pipe(parser)
          .on('error', (error) => {
            expect(error).toBeNull();
          });
      });
    }
  });
});
