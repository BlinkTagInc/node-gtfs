import assert from 'node:assert/strict';
import { startTestHttpServer } from '../helpers/http-server.ts';
import { test } from 'node:test';

import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import { refreshGtfsRealtime, type GtfsReportEvent } from '../../src/index.ts';

for (const failure of [
  'before-headers',
  'stalled-body',
  'disconnected-body',
] as const) {
  test(
    `public Realtime refresh recovers from ${failure} with backoff and no partial writes`,
    { timeout: 10_000 },
    async (t) => {
      const database = new Database(':memory:');
      t.after(() => database.close());
      const realtime = GtfsRealtimeBindings.transit_realtime;
      const payload = realtime.FeedMessage.encode(
        realtime.FeedMessage.fromObject({
          header: {
            gtfsRealtimeVersion: '2.0',
            incrementality: 'FULL_DATASET',
            timestamp: 1,
          },
          entity: [
            {
              id: 'recovered',
              alert: {
                headerText: {
                  translation: [{ text: 'Recovered after timeout' }],
                },
                descriptionText: {
                  translation: [{ text: 'The retry returned a valid alert' }],
                },
                informedEntity: [{ stopId: 'stop-1' }],
              },
            },
          ],
        }),
      ).finish();
      const requests: number[] = [];
      const events: GtfsReportEvent[] = [];
      const retryTimes: number[] = [];
      let firstRequestAborted = false;
      const origin = await startTestHttpServer(t, (_request, response) => {
        requests.push(performance.now());
        if (requests.length === 1) {
          if (failure !== 'before-headers') {
            response.writeHead(200, {
              'Content-Type': 'application/x-protobuf',
              'Content-Length': payload.length,
            });
            response.write(payload.subarray(0, 2));
          }
          response.once('close', () => {
            firstRequestAborted = !response.writableEnded;
          });
          if (failure === 'disconnected-body') {
            setImmediate(() => response.destroy());
          }
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/x-protobuf' });
        response.end(payload);
      });
      const result = await refreshGtfsRealtime({
        database: { client: database },
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'retry',
            realtime: {
              feeds: [
                {
                  type: 'alerts',
                  url: `${origin}/alerts.pb`,
                  timeoutMs: 250,
                },
              ],
            },
          },
        ],
        reporting: {
          reporter: (event) => {
            events.push(event);
            if (event.level === 'warn' && event.message.includes('retrying')) {
              assert.deepEqual(
                database.prepare('select entity_id from alerts').all(),
                [],
              );
              assert.deepEqual(
                database
                  .prepare('select snapshot_id from realtime_snapshots')
                  .all(),
                [],
              );
              retryTimes.push(performance.now());
            }
          },
        },
      });
      assert.equal(result.success, true);
      assert.equal(firstRequestAborted, true);
      assert.equal(requests.length, 2);
      assert.equal(retryTimes.length, 1);
      const [, retriedAt] = requests;
      const [warnedAt] = retryTimes;
      assert.ok(retriedAt !== undefined && warnedAt !== undefined);
      assert.ok(
        retriedAt - warnedAt >= 900,
        'Default one-second retry delay must not be bypassed',
      );
      assert.match(
        events.find((event) => event.level === 'warn')?.message ?? '',
        failure === 'disconnected-body'
          ? /Could not download/
          : /timed out after 250 ms/,
      );
      assert.deepEqual(
        database.prepare('select entity_id, header_text from alerts').all(),
        [{ entity_id: 'recovered', header_text: 'Recovered after timeout' }],
      );
    },
  );
}
