import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  countGtfsRows,
} from './test-utils.ts';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRoutes,
  getStops,
  prepDirectory,
  unzip,
  isGtfsError,
  GtfsErrorCode,
} from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';

const agenciesFixturesLocal = config.agencies;

describe('importGtfs():', () => {
  describe('Download and import from different GTFS sources', () => {
    let server: Server;
    let agenciesFixturesRemote: Array<{ url: string }>;

    beforeAll(async () => {
      // Serving the fixture locally exercises the same fetch/unzip path as a
      // real download without depending on network access or a third-party
      // host staying online.
      const fixture = await readFile(agenciesFixturesLocal[0].path);

      server = createServer((request, response) => {
        if (request.url === '/slow-gtfs.zip') {
          // Stall long enough that a short downloadTimeout always aborts.
          setTimeout(() => {
            response.writeHead(200, { 'Content-Type': 'application/zip' });
            response.end(fixture);
          }, 5000).unref();
          return;
        }

        response.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': String(fixture.length),
        });
        response.end(fixture);
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
      });

      const { port } = server.address() as { port: number };
      agenciesFixturesRemote = [{ url: `http://127.0.0.1:${port}/gtfs.zip` }];
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    });

    beforeEach(async () => {
      openDb();
      await importGtfs(config);
    });

    afterEach(() => {
      closeDb(openDb());
    });

    it('should be able to download and import from HTTP', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesRemote,
      });

      expect(getRoutes()).toHaveLength(4);
    });

    it('should be able to download and import from HTTP with a downloadTimeout', async () => {
      const { port } = server.address() as { port: number };
      let didThrow = false;

      try {
        await importGtfs({
          ...config,
          agencies: [{ url: `http://127.0.0.1:${port}/slow-gtfs.zip` }],
          downloadTimeout: 50,
        });
      } catch (error: unknown) {
        didThrow = true;
        expect(isGtfsError(error)).toBeTruthy();
        expect((error as { code?: unknown }).code).toEqual(
          GtfsErrorCode.GTFS_DOWNLOAD_FAILED,
        );
      }

      expect(didThrow).toBeTruthy();
    });

    it('should throw a download error when the server responds with an error status', async () => {
      const errorServer = createServer((request, response) => {
        response.writeHead(404);
        response.end('not found');
      });
      await new Promise<void>((resolve) => {
        errorServer.listen(0, '127.0.0.1', resolve);
      });
      const { port } = errorServer.address() as { port: number };

      try {
        let didThrow = false;
        try {
          await importGtfs({
            ...config,
            agencies: [{ url: `http://127.0.0.1:${port}/missing.zip` }],
          });
        } catch (error: unknown) {
          didThrow = true;
          expect(isGtfsError(error)).toBeTruthy();
          // An error status is reported distinctly from a transport failure.
          expect((error as { code?: unknown }).code).toEqual(
            GtfsErrorCode.GTFS_DOWNLOAD_HTTP,
          );
        }
        expect(didThrow).toBeTruthy();
      } finally {
        await new Promise<void>((resolve, reject) => {
          errorServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it('should be able to download and import from local filesystem', async () => {
      await importGtfs({
        ...config,
        agencies: agenciesFixturesLocal,
      });

      expect(getRoutes()).toHaveLength(4);
    });

    it("should throw an error when importing from local filesystem which doesn't exist", async () => {
      let didThrow = false;

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
        didThrow = true;
        expect((error as Error).message).toMatch(
          /Unable to load files from path/,
        );
      }

      expect(didThrow).toBeTruthy();
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
    const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-import-test-'));
    let countData: Record<string, number> = {};

    beforeAll(async () => {
      await prepDirectory(temporaryDir);
      await unzip(agenciesFixturesLocal[0].path, temporaryDir);
      countData = await countGtfsRows(temporaryDir);

      openDb();
      await importGtfs(config);
    });

    afterAll(async () => {
      closeDb(openDb());
      await rm(temporaryDir, { recursive: true, force: true });
    });

    const tablesToValidate = Object.entries(gtfsManifest).filter(
      ([, definition]) => definition.namespace !== 'gtfs-realtime',
    );

    for (const [tableName] of tablesToValidate) {
      it(`should import the same number of ${tableName}`, () => {
        const db = openDb();
        const result = db
          .prepare(`SELECT COUNT(*) FROM ${tableName};`)
          .get() as { 'COUNT(*)': number };

        expect(result['COUNT(*)']).toEqual(countData[tableName]);
      });
    }
  });
});
