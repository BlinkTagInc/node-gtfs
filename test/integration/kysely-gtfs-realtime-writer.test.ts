import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type LogEvent,
} from 'kysely';

import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { createKyselyGtfsRealtimeWriter } from '../../src/database/kysely/realtime-writer.ts';
import type { RealtimeSnapshotApplication } from '../../src/realtime/writer.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { sourceStateTable } from '../../src/database/source-state.ts';

test('Kysely Realtime inserts use the shared MySQL storage-key projection', async () => {
  const queries: LogEvent[] = [];
  const database = new Kysely<Record<string, Record<string, unknown>>>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new MysqlIntrospector(db),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
    log(event) {
      if (event.level === 'query') {
        queries.push(event);
      }
    },
  });
  const plan = createGtfsStoragePlan({
    dialect: 'mysql',
    tables: [
      sourceStateTable,
      compiledTableRegistry.realtimeFeeds,
      compiledTableRegistry.realtimeSnapshots,
      compiledTableRegistry.realtimeFeedEntities,
    ],
  });
  const snapshot: RealtimeSnapshotApplication = {
    sourceId: 'source',
    realtimeFeedId: 'feed',
    feedType: 'alerts',
    feedUrl: 'https://example.test/alerts.pb',
    snapshotId: 'snapshot',
    fetchedAtUnixSeconds: 1,
    httpStatus: 200,
    httpHeaders: null,
    contentType: 'application/x-protobuf',
    feedHeaderVersion: '2.0',
    feedHeaderIncrementality: 'DIFFERENTIAL',
    feedHeaderUnixSeconds: 1,
    payloadSha256: 'payload',
    rawPayloadBase64: 'AA==',
    retentionExpiresAtUnixSeconds: null,
    applicationMode: 'history-only',
    entities: [],
  };

  try {
    const result = await createKyselyGtfsRealtimeWriter(
      database,
      plan,
    ).applySnapshot(snapshot, null);
    assert.deepEqual(result, {
      recordCount: 0,
      errors: [],
      duplicateSnapshot: false,
    });

    const feedInsert = queries.find(({ query }) =>
      query.sql.trimStart().startsWith('insert into `realtime_feeds`'),
    )?.query;
    const snapshotInsert = queries.find(({ query }) =>
      query.sql.trimStart().startsWith('insert into `realtime_snapshots`'),
    )?.query;
    assert.match(feedInsert?.sql ?? '', /`_node_gtfs_storage_key`/u);
    assert.match(snapshotInsert?.sql ?? '', /`_node_gtfs_storage_key`/u);
    assert.equal(
      feedInsert?.parameters.includes(
        'c8abcc115fe0900e65a87f4144cfe7633128e604059d5be6a655f49351b40a36',
      ),
      true,
    );
    assert.equal(
      snapshotInsert?.parameters.includes(
        '764101c99091eee9e9defdcc73641ef28908446d932c8f6a89928a1361c284ad',
      ),
      true,
    );
  } finally {
    await database.destroy();
  }
});
