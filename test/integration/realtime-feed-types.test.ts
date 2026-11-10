import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { Gtfs } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';
const feedTypes = [
  'alerts',
  'tripUpdates',
  'vehiclePositions',
  'shapes',
  'stops',
  'tripModifications',
  'mixed',
] as const;
for (const adapter of ['native SQLite', 'Kysely SQLite'] as const) {
  test(`${adapter} persists configured feed types and filters snapshots by feed`, async (t) => {
    const sqlite = new Database(':memory:');
    const kysely = new Kysely<GtfsDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const gtfs = new Gtfs({
      database: {
        client: adapter === 'native SQLite' ? sqlite : kysely,
      },
      extensions: ['gtfs-realtime'],
      sources: [
        {
          sourceId: 'test',
          realtime: {
            feeds: feedTypes.map((type) => ({
              type,
              url: `https://example.test/${type}.pb`,
            })),
          },
        },
      ],
    });
    const realtime = GtfsRealtimeBindings.transit_realtime;
    const payload = realtime.FeedMessage.encode(
      realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [],
      }),
    ).finish();
    t.mock.method(globalThis, 'fetch', async () => new Response(payload));
    try {
      await gtfs.schema.recreate();
      assert.equal((await gtfs.realtime.refresh()).success, true);
      assert.deepEqual(
        await gtfs.realtime.persistence.feeds
          .select('feed_type')
          .orderBy([{ field: 'feed_type', direction: 'asc' }])
          .all(),
        [...feedTypes].sort().map((feed_type) => ({ feed_type })),
      );
      assert.equal(
        (
          await gtfs.database.withKysely({
            callback: (db) =>
              db
                .selectFrom('realtime_snapshots as snapshot')
                .innerJoin('realtime_feeds as feed', (join) =>
                  join
                    .onRef('feed.source_id', '=', 'snapshot.source_id')
                    .onRef(
                      'feed.realtime_feed_id',
                      '=',
                      'snapshot.realtime_feed_id',
                    ),
                )
                .where('snapshot.source_id', '=', 'test')
                .where('feed.feed_type', '=', 'tripUpdates')
                .select('snapshot.snapshot_id')
                .execute(),
          })
        ).length,
        1,
      );
      assert.equal(await gtfs.realtime.persistence.feedEntities.count(), 0);
    } finally {
      await gtfs.close();
      await kysely.destroy();
    }
  });
}
