import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import assert from 'node:assert/strict';

import { describe, it } from 'node:test';
import { refreshGtfsRealtime, type GtfsReportEvent } from '../../src/index.ts';
import { createSqliteGtfsTables } from '../../src/sqlite.ts';

const { transit_realtime: realtime } = GtfsRealtimeBindings;

describe('GTFS-Realtime reporting', () => {
  it('reports a successful refresh lifecycle in milliseconds', async () => {
    const db = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const events: GtfsReportEvent[] = [];
    try {
      const message = realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [],
      });
      const payload = Buffer.from(
        realtime.FeedMessage.encode(message).finish(),
      );
      globalThis.fetch = (async () =>
        new Response(payload, { status: 200 })) as typeof fetch;

      const result = await refreshGtfsRealtime({
        database: { client: db },
        sources: [
          {
            sourceId: 'reporting',
            realtime: {
              feeds: [
                {
                  feedId: 'vehicles',
                  url: 'https://example.test/vehicle-positions',
                },
              ],
            },
          },
        ],
        extensions: ['gtfs-realtime'],
        reporting: { reporter: (event) => events.push(event) },
      });

      assert.equal(result.success, true);
      const start = events.find((event) => event.type === 'operation:start');
      const completion = events.find(
        (event) => event.type === 'operation:complete',
      );
      assert.equal(start?.operation, 'realtime');
      assert.equal(start?.sourceCount, 1);
      assert.equal(completion?.operation, 'realtime');
      assert.equal(Number.isSafeInteger(completion?.durationMs), true);
      assert.equal((completion?.durationMs ?? -1) >= 0, true);
    } finally {
      globalThis.fetch = originalFetch;
      db.close();
    }
  });

  it('should send structured batch failures through reporter', async () => {
    const db = new Database(':memory:');
    const originalFetch = globalThis.fetch;
    const events: GtfsReportEvent[] = [];

    try {
      createSqliteGtfsTables({
        database: db,
        extensions: ['gtfs-realtime'],
      });
      db.exec(`CREATE TRIGGER fail_vehicle_write BEFORE INSERT ON vehicle_positions
        BEGIN SELECT RAISE(ABORT, 'simulated batch failure'); END`);

      const message = realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'vehicle-position-entity',
            vehicle: {
              vehicle: { id: 'vehicle-1' },
              position: { latitude: 37.77, longitude: -122.42 },
            },
          },
        ],
      });
      const payload = Buffer.from(
        realtime.FeedMessage.encode(message).finish(),
      );
      globalThis.fetch = (async () =>
        new Response(payload, { status: 200 })) as typeof fetch;

      await assert.rejects(
        () =>
          refreshGtfsRealtime({
            database: { client: db },
            sources: [
              {
                sourceId: 'vehicle-positions',
                realtime: {
                  feeds: [
                    {
                      feedId: 'vehicles',
                      url: 'https://example.test/vehicle-positions',
                    },
                  ],
                },
              },
            ],
            extensions: ['gtfs-realtime'],
            reporting: {
              level: 'error',
              reporter(event) {
                events.push(event);
              },
            },
          }),
        (error: unknown) =>
          (error as { code?: string }).code ===
          'GTFS_DATABASE_OPERATION_FAILED',
      );

      assert.equal(events.length, 1);
      const event = events[0]!;
      if (event.type !== 'message') {
        throw new Error(`Expected a message event, got ${event.type}`);
      }
      assert.equal(event.level, 'error');
      assert.ok(event.message.length > 0);
      assert.equal(event.error?.code, 'GTFS_DATABASE_OPERATION_FAILED');
      assert.equal(event.error?.category, 'database');
      assert.equal(event.error?.details?.sourceId, 'vehicle-positions');
      assert.equal(typeof event.error?.details?.snapshotId, 'string');
      assert.equal(event.sourceId, 'vehicle-positions');
      assert.ok(Object.isFrozen(event));
    } finally {
      globalThis.fetch = originalFetch;
      db.close();
    }
  });
});
