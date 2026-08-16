import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from './test-utils.ts';
import path from 'node:path';
import { createReadStream, existsSync, mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parse } from 'csv-parse';

import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  exportGtfs,
  getAgencies,
  unzip,
  generateFolderName,
  prepDirectory,
} from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';

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
      [key: string]: number;
    } = {};
    const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-'));

    beforeAll(async () => {
      await prepDirectory(temporaryDir);
      await unzip(config.agencies[0].path, temporaryDir);

      await Promise.all(
        Object.entries(gtfsManifest).map(([tableName, definition]) => {
          if (definition.file === null) return false;
          const filePath = path.join(temporaryDir, definition.file);

          // GTFS has optional files
          if (!existsSync(filePath)) {
            countData[tableName] = 0;
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

              countData[tableName] = data.length;
            },
          );

          return createReadStream(filePath)
            .pipe(parser)
            .on('error', (error) => {
              countData[tableName] = 0;
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

    const tablesToValidate = Object.entries(gtfsManifest).filter(
      ([, definition]) => definition.namespace !== 'gtfs-realtime',
    );

    for (const [tableName, definition] of tablesToValidate) {
      it(`should import the same number of ${tableName}`, async () => {
        const agencies = getAgencies({}, ['agency_name']);
        const filePath = path.join(
          process.cwd(),
          'gtfs-export',
          generateFolderName(agencies[0].agency_name),
          definition.file as string,
        );

        // GTFS has optional files
        if (!existsSync(filePath)) {
          expect(countData[tableName]).toEqual(0);
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

            expect(data).toHaveLength(countData[tableName]);
          },
        );

        createReadStream(filePath)
          .pipe(parser)
          .on('error', (error) => {
            expect(error).toBeNull();
          });
      });
    }
  });
});
