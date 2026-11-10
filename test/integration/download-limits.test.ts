import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import {
  importGtfs,
  refreshGtfsRealtime,
  isGtfsError,
  type GtfsReportEvent,
} from '../../src/index.ts';

for (const kind of ['schedule', 'realtime'] as const) {
  for (const transport of ['declared', 'chunked', 'gzip'] as const) {
    test(
      `${kind} rejects oversized ${transport} HTTP bodies without changing existing data`,
      { timeout: 10_000 },
      async (t) => {
        const database = new Database(':memory:');
        t.after(() => database.close());
        const data = Buffer.alloc(2048, 65);
        let requests = 0;
        const valid = Buffer.from(
          GtfsRealtimeBindings.transit_realtime.FeedMessage.encode({
            header: { gtfsRealtimeVersion: '2.0' },
            entity: [
              {
                id: 'kept',
                alert: {
                  headerText: { translation: [{ text: 'Keep this alert' }] },
                  descriptionText: {
                    translation: [{ text: 'Existing current state' }],
                  },
                  informedEntity: [{ stopId: 'stop-1' }],
                },
              },
            ],
          }).finish(),
        );
        const server = createServer((request, response) => {
          if (request.url === '/valid') {
            response.end(valid);
            return;
          }
          requests++;
          if (transport === 'declared') {
            response.writeHead(200, { 'Content-Length': data.byteLength });
            response.end(data);
          } else if (transport === 'gzip') {
            const compressed = gzipSync(data);
            assert.ok(compressed.byteLength < 1024);
            response.writeHead(200, {
              'Content-Encoding': 'gzip',
              'Content-Length': compressed.byteLength,
            });
            response.end(compressed);
          } else {
            response.writeHead(200, { 'Transfer-Encoding': 'chunked' });
            response.write(data.subarray(0, 512));
            response.end(data.subarray(512));
          }
        });
        t.after(
          () =>
            new Promise<void>((resolve, reject) => {
              server.close((error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              });
              server.closeAllConnections();
            }),
        );
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const url = `http://127.0.0.1:${address.port}`;
        const events: GtfsReportEvent[] = [];
        const common = {
          database: { client: database },
          reporting: {
            reporter: (event: GtfsReportEvent) => events.push(event),
          },
        };
        if (kind === 'schedule') {
          await importGtfs({
            ...common,
            sources: [{ schedule: { path: 'test/fixtures/complete' } }],
          });
        } else {
          await refreshGtfsRealtime({
            ...common,
            extensions: ['gtfs-realtime'],
            sources: [
              {
                realtime: { feeds: [{ type: 'alerts', url: `${url}/valid` }] },
              },
            ],
          });
        }
        const inventory = () =>
          kind === 'schedule'
            ? database.prepare('SELECT * FROM agency').all()
            : {
                alerts: database.prepare('SELECT * FROM alerts').all(),
                snapshots: database
                  .prepare('SELECT * FROM realtime_snapshots')
                  .all(),
              };
        const before = inventory();
        events.length = 0;
        const run =
          kind === 'schedule'
            ? () =>
                importGtfs({
                  ...common,
                  sources: [
                    {
                      schedule: {
                        url: `${url}/oversized`,
                        import: { archive: { maxCompressedBytes: 1024 } },
                      },
                    },
                  ],
                })
            : () =>
                refreshGtfsRealtime({
                  ...common,
                  extensions: ['gtfs-realtime'],
                  sources: [
                    {
                      realtime: {
                        feeds: [
                          {
                            type: 'alerts',
                            url: `${url}/oversized`,
                            maxDownloadBytes: 1024,
                          },
                        ],
                      },
                    },
                  ],
                });
        await assert.rejects(run, (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, 'GTFS_DOWNLOAD_TOO_LARGE');
          assert.equal(error.category, 'download');
          assert.equal(error.details?.maximum, 1024);
          assert.equal(
            error.details?.limit,
            kind === 'schedule' ? 'maxCompressedBytes' : 'maxDownloadBytes',
          );
          assert.equal(error.details?.url, `${url}/oversized`);
          return true;
        });
        assert.deepEqual(inventory(), before);
        assert.equal(requests, 1, 'Resource-limit failures must not retry');
        assert.ok(!events.some((event) => event.message.includes('retrying')));
      },
    );
  }
}
