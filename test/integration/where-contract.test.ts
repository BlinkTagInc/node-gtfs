import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Gtfs, isGtfsError } from '../../src/index.ts';
test('repositories reject undefined filter values before SQL, including empty and missing tables', async () => {
  let queryCount = 0;
  const sqlite = new Database(':memory:', {
    verbose() {
      queryCount += 1;
    },
  });
  const gtfs = new Gtfs({
    database: { client: sqlite },
    extensions: ['gtfs-realtime'],
  });
  try {
    for (const withSchema of [false, true]) {
      if (withSchema) {
        await gtfs.schema.ensure();
      }
      const filters = [
        undefined,
        { route_desc: undefined },
        { trips: { some: { route_id: undefined } } },
      ];
      for (const filter of filters) {
        for (const terminal of [
          () => gtfs.schedule.routes.where(filter as never).all(),
          () => gtfs.schedule.routes.where(filter as never).first(),
          () => gtfs.schedule.routes.where(filter as never).count(),
        ]) {
          queryCount = 0;
          await assert.rejects(
            async () => terminal(),
            (error: unknown) => {
              assert.ok(isGtfsError(error));
              assert.equal(error.code, 'GTFS_QUERY_INVALID');
              assert.equal(error.category, 'query');
              assert.equal(error.details?.reason, 'undefined-filter-value');
              assert.match(String(error.details?.path), /^where(?:\.|$)/);
              return true;
            },
          );
          assert.equal(queryCount, 0);
        }
      }
    }
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});
test('GeoJSON rejects explicit undefined in the same filters as repositories before SQL', async () => {
  let queryCount = 0;
  const sqlite = new Database(':memory:', {
    verbose() {
      queryCount += 1;
    },
  });
  const gtfs = new Gtfs({ database: { client: sqlite } });
  try {
    for (const method of ['stops', 'shapes', 'routes'] as const) {
      for (const options of [
        { where: undefined },
        { where: { source_id: undefined } },
      ]) {
        queryCount = 0;
        await assert.rejects(
          async () => gtfs.geojson[method](options as never),
          {
            code: 'GTFS_QUERY_INVALID',
          },
        );
        assert.equal(queryCount, 0);
      }
    }
    queryCount = 0;
    await assert.rejects(
      async () =>
        gtfs.geojson.stops({
          where: { stop_id: undefined } as never,
        }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.details?.reason, 'undefined-filter-value');
        return true;
      },
    );
    assert.equal(queryCount, 0);
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});
test('omitted fields, null and scalar equality retain their distinct meanings', async () => {
  const sqlite = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: sqlite },
    sources: [{ sourceId: 'source' }],
  });
  try {
    await gtfs.schema.ensure();
    sqlite.exec(`INSERT INTO routes (source_id, route_id, route_type, route_desc) VALUES
      ('source', 'a', 3, NULL), ('source', 'b', 3, 'description'), ('other', 'c', 3, NULL)`);
    for (const [where, expected] of [
      [{}, ['a', 'b']],
      [{ route_desc: null }, ['a']],
      [{ route_desc: 'description' }, ['b']],
      [{ source_id: 'other' }, []],
    ] as const) {
      assert.deepEqual(
        await gtfs.schedule.routes
          .where(where)
          .select('route_id')
          .orderBy([{ field: 'route_id', direction: 'asc' }])
          .all(),
        expected.map((route_id) => ({ route_id })),
      );
      assert.deepEqual(
        await gtfs.schedule.routes
          .where(where)
          .select('route_id')
          .orderBy([{ field: 'route_id', direction: 'asc' }])
          .first(),
        expected.length === 0 ? null : { route_id: expected[0] },
      );
      assert.equal(
        await gtfs.schedule.routes.where(where).count(),
        expected.length,
      );
    }
    assert.equal(await gtfs.schedule.routes.count(), 2);
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});
