import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from './test-utils.ts';
import { createReadStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse';
import { temporaryDirectory } from 'tempy';

import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRoutes,
  getStops,
  prepDirectory,
  unzip,
} from '../../dist/index.js';
import * as models from '../../dist/models/models.js';
import type { Model } from '../../dist/types/global_interfaces.js';

const agenciesFixturesRemote = [
  {
    url: 'http://transitfeeds.com/p/caltrain/122/20160406/download',
  },
];

const agenciesFixturesLocal = config.agencies;

describe('importGtfs():', function () {
  describe('Download and import from different GTFS sources', () => {
    beforeEach(async () => {
      openDb();
      await importGtfs(config);
    });

    afterEach(() => {
      const db = openDb();
      closeDb(db);
    });

    it('should be able to download and import from HTTP', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesRemote,
      });

      const routes = getRoutes();

      expect(routes).toHaveLength(4);
    });

    it('should be able to download and import from HTTP with a downloadTimeout', async () => {
      try {
        await importGtfs({
          ...config,
          agencies: agenciesFixturesRemote,
          downloadTimeout: 1,
        });
      } catch (error: unknown) {
        expect((error as Error).name).toEqual('TimeoutError');
      }
    });

    it('should be able to download and import from local filesystem', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesLocal,
      });

      const routes = getRoutes();

      expect(routes).toHaveLength(4);
    });

    it("should throw an error when importing from local filesystem which doesn't exist", async () => {
      try {
        await importGtfs({
          ...config,
          agencies: [
            {
              path: '/does/not/exist',
            },
          ],
        });
      } catch (error: unknown) {
        expect((error as Error).message).toMatch(
          /Unable to load files from path/,
        );
      }
    });

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

      expect(routes).toHaveLength(4);
      expect(routes[0].route_id).toMatch(new RegExp(`^${prefix}`));

      const stops = getStops();

      expect(stops).toHaveLength(95);
      expect(stops[0].stop_id).toMatch(new RegExp(`^${prefix}`));
    });
  });

  describe('Verify data imported into database', () => {
    const countData: {
      [key: string]: number;
    } = {};
    const temporaryDir = temporaryDirectory();

    beforeAll(async () => {
      await prepDirectory(temporaryDir);
      await unzip(agenciesFixturesLocal[0].path, temporaryDir);

      await Promise.all(
        (Object.values(models) as Model[]).map((model) => {
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
      await rm(temporaryDir, { recursive: true, force: true });
    });

    const modelsToValidate = (Object.values(models) as Model[]).filter(
      (model) => model.extension !== 'gtfs-realtime',
    );

    for (const model of modelsToValidate) {
      it(`should import the same number of ${model.filenameBase}`, () => {
        const db = openDb();
        const result = db
          .prepare(`SELECT COUNT(*) FROM ${model.filenameBase};`)
          .get() as { 'COUNT(*)': number };

        expect(result['COUNT(*)']).toEqual(countData[model.filenameBase]);
      });
    }
  });
});
