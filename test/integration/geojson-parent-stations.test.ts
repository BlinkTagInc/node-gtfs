import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, type CompiledQuery } from 'kysely';
import { createGtfsGeoJSON } from '../../src/geojson/geojson.ts';
import { loadStopsGeoJSONData } from '../../src/geojson/data.ts';
import { createSqliteGtfsTables } from '../../src/database/sqlite/schema-writer.ts';

test('useParentStation rejects non-booleans and non-stop methods before SQL', async () => {
  let operations = 0;
  const geojson = createGtfsGeoJSON({
    databaseOperation: async () => {
      operations += 1;
      throw new Error('Unexpected SQL');
    },
    dialect: 'sqlite',
    enabledExtensions: [],
    sourceIds: null,
  });
  for (const value of [
    undefined,
    null,
    0,
    1,
    'true',
    'false',
    [],
    {},
    () => true,
  ]) {
    await assert.rejects(geojson.stops({ useParentStation: value } as never), {
      code: 'GTFS_QUERY_INVALID',
      message: '`gtfs.geojson.stops.useParentStation` must be a boolean',
      details: {
        table: 'stops',
        method: 'gtfs.geojson.stops',
        option: 'useParentStation',
      },
    });
  }
  for (const method of ['shapes', 'routes'] as const) {
    await assert.rejects(geojson[method]({ useParentStation: true } as never), {
      code: 'GTFS_QUERY_INVALID',
      details: {
        table: method,
        method: `gtfs.geojson.${method}`,
        option: 'useParentStation',
      },
    });
  }
  assert.equal(operations, 0);
});

test('parent-station lookups stay source-scoped and batched beyond SQLite parameter limits', async () => {
  const sqlite = new Database(':memory:');
  const queries: CompiledQuery[] = [];
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === 'query') {
        queries.push(event.query);
      }
    },
  });
  try {
    createSqliteGtfsTables({ database: sqlite });
    const insert = sqlite.prepare(
      'insert into stops(source_id,stop_id,location_type,parent_station,stop_lat,stop_lon,stop_name) values (?,?,?,?,?,?,?)',
    );
    const count = 1001;
    sqlite.transaction(() => {
      for (const source of ['alpha', 'beta']) {
        for (let index = 0; index < count; index += 1) {
          const id = String(index).padStart(4, '0');
          insert.run(
            source,
            `station-${id}`,
            1,
            null,
            0,
            0,
            `${source} Station ${id}`,
          );
          insert.run(source, id, 0, `station-${id}`, 1, 1, 'Child');
        }
      }
    })();
    const data = await loadStopsGeoJSONData({
      database,
      dialect: 'sqlite',
      enabledExtensions: [],
      sourceIds: null,
      where: { location_type: 0 },
      useParentStation: true,
    });
    assert.equal(data.stops.length, count * 2);
    assert.equal(
      new Set(
        data.stops.map((stop) =>
          JSON.stringify([stop.source_id, stop.stop_id]),
        ),
      ).size,
      count * 2,
    );
    for (const stop of data.stops) {
      assert.equal(stop.location_type, 1);
      assert.equal(
        stop.stop_name,
        `${stop.source_id} Station ${stop.stop_id.slice('station-'.length)}`,
      );
      assert.equal(stop.stop_lat, 0);
      assert.equal(stop.stop_lon, 0);
    }
    assert.ok(
      queries.length > 1 && queries.length < 40,
      'Queries should scale by batches, not by station',
    );
    assert.ok(queries.every((query) => query.parameters.length <= 999));
    sqlite.exec('drop table stops');
    await assert.rejects(
      loadStopsGeoJSONData({
        database,
        dialect: 'sqlite',
        enabledExtensions: [],
        sourceIds: null,
        where: {},
        useParentStation: true,
      }),
      { code: 'GTFS_SCHEMA_INVALID' },
    );
  } finally {
    await database.destroy();
  }
});
