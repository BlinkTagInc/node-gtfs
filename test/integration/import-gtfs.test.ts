import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import {
  countFeedInventory,
  extractFixtureArchive,
  recreateFixtureDirectory,
} from '../helpers/test-utils.ts';
import { startTestHttpServer } from '../helpers/http-server.ts';
import { mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import config from '../helpers/test-config.ts';
import {
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
  type GtfsImportOptions,
} from '../../src/index.ts';
import { gtfsManifest } from '../../src/schema/index.ts';

const scheduleSourcesLocal = config.sources;
const scheduleManifest = Object.fromEntries(
  Object.entries(gtfsManifest).filter(
    ([, definition]) => definition.specification === 'gtfs-schedule',
  ),
);
const HTTP_TEST_TIMEOUT_MS = 10_000;
const scheduleFixture = readFileSync(scheduleSourcesLocal[0].schedule.path);

describe('importGtfs():', () => {
  describe('Download and import from different GTFS sources', () => {
    let sqlite: Database.Database;
    let operationConfig: GtfsImportOptions;

    beforeEach(() => {
      sqlite = new Database(':memory:');
      operationConfig = {
        ...config,
        extensions: [],
        database: { client: sqlite },
      };
    });

    afterEach(() => {
      sqlite.close();
    });

    it(
      'should be able to download and import from HTTP',
      { timeout: HTTP_TEST_TIMEOUT_MS },
      async (t) => {
        const origin = await startTestHttpServer(t, (_request, response) => {
          response.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Length': String(scheduleFixture.length),
          });
          response.end(scheduleFixture);
        });

        await importGtfs({
          ...operationConfig,
          sources: [
            {
              sourceId: 'remote',
              schedule: { url: `${origin}/gtfs.zip` },
            },
          ],
        });

        assert.equal(sqlite.prepare('SELECT * FROM routes').all().length, 4);
      },
    );

    it(
      'applies request headers independently to each Schedule source',
      { timeout: HTTP_TEST_TIMEOUT_MS },
      async (t) => {
        const receivedSourceHeaders: string[] = [];
        const origin = await startTestHttpServer(t, (request, response) => {
          const sourceHeader = request.headers['x-gtfs-source'];
          if (typeof sourceHeader === 'string') {
            receivedSourceHeaders.push(sourceHeader);
          }
          response.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Length': String(scheduleFixture.length),
          });
          response.end(scheduleFixture);
        });

        const url = `${origin}/gtfs.zip`;

        await importGtfs({
          ...operationConfig,
          sources: [
            {
              sourceId: 'remote-first',
              schedule: {
                url,
                requestHeaders: { 'X-GTFS-Source': 'first' },
              },
            },
            {
              sourceId: 'remote-second',
              schedule: {
                url,
                requestHeaders: { 'X-GTFS-Source': 'second' },
              },
            },
          ],
        });

        assert.deepEqual(receivedSourceHeaders, ['first', 'second']);
      },
    );

    it(
      'applies schedule.timeoutMs to an HTTP download',
      { timeout: HTTP_TEST_TIMEOUT_MS },
      async (t) => {
        const origin = await startTestHttpServer(t, (request, response) => {
          request.once('close', () => response.destroy());
        });

        await assert.rejects(
          importGtfs({
            ...operationConfig,
            sources: [
              {
                sourceId: 'test',
                schedule: {
                  url: `${origin}/slow-gtfs.zip`,
                  timeoutMs: 50,
                },
              },
            ],
          }),
          (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.DOWNLOAD_FAILED);
            return true;
          },
        );
      },
    );

    it(
      'should throw a download error when the server responds with an error status',
      { timeout: HTTP_TEST_TIMEOUT_MS },
      async (t) => {
        const origin = await startTestHttpServer(t, (_request, response) => {
          response.writeHead(404);
          response.end('not found');
        });

        await assert.rejects(
          importGtfs({
            ...operationConfig,
            sources: [
              {
                sourceId: 'test',
                schedule: {
                  url: `${origin}/missing.zip?api_key=secret-token`,
                },
              },
            ],
          }),
          (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.DOWNLOAD_HTTP_FAILED);
            assert.ok(!error.message.includes('secret-token'));
            const errorUrl = error.details?.url;
            assert.ok(typeof errorUrl === 'string');
            assert.ok(!errorUrl.includes('secret-token'));
            return true;
          },
        );
      },
    );

    it('should be able to download and import from local filesystem', async () => {
      await importGtfs({
        ...operationConfig,
        sources: scheduleSourcesLocal,
      });

      assert.equal(sqlite.prepare('SELECT * FROM routes').all().length, 4);
    });

    it("should throw an error when importing from local filesystem which doesn't exist", async () => {
      let didThrow = false;

      try {
        await importGtfs({
          ...operationConfig,
          sources: [
            {
              sourceId: 'missing',
              schedule: { path: '/does/not/exist' },
            },
          ],
        });
      } catch (error: unknown) {
        didThrow = true;
        assert.match(
          (error as Error).message,
          /Could not read GTFS source directory/,
        );
      }

      assert.ok(didThrow);
    });
  });

  describe('Verify data imported into database', () => {
    const temporaryDir = mkdtempSync(path.join(tmpdir(), 'gtfs-import-test-'));
    let countData: Record<string, number> = {};
    let sqlite: Database.Database;

    before(async () => {
      await recreateFixtureDirectory(temporaryDir);
      await extractFixtureArchive(
        scheduleSourcesLocal[0].schedule.path,
        temporaryDir,
      );
      countData = await countFeedInventory(temporaryDir, scheduleManifest);

      sqlite = new Database(':memory:');
      await importGtfs({
        ...config,
        extensions: [],
        database: { client: sqlite },
      });
    });

    after(async () => {
      sqlite.close();
      await rm(temporaryDir, { recursive: true, force: true });
    });

    it('matches the Schedule source row-count inventory', () => {
      const importedCounts = Object.fromEntries(
        Object.keys(scheduleManifest).map((tableName) => [
          tableName,
          sqlite.prepare(`SELECT COUNT(*) FROM "${tableName}"`).pluck().get(),
        ]),
      );
      assert.deepEqual(importedCounts, countData);
    });
  });
});
