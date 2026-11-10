import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import {
  createSqliteGtfsTables,
  createSqliteGtfsIndexes,
} from '../../src/database/sqlite/schema-writer.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';

test('SQL stops-by-route membership uses route and source-scoped trip/stop lookups', async () => {
  const sqlite = new Database(':memory:');
  const database = new Kysely<GtfsDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    createSqliteGtfsTables({ database: sqlite });
    sqlite.exec(`
      with recursive ids(n) as (select 0 union all select n+1 from ids where n<999)
      insert into stops(source_id,stop_id) select 'north', cast(n as text) from ids;
      with recursive ids(n) as (select 0 union all select n+1 from ids where n<999)
      insert into trips(source_id,trip_id,route_id,service_id)
      select 'north', cast(n as text), case when n<3 then 'rare' else 'common' end, 'daily' from ids;
      with recursive ids(n) as (select 0 union all select n+1 from ids where n<9999)
      insert into stop_times(source_id,trip_id,stop_id,stop_sequence)
      select 'north', cast(n/10 as text), cast(n%10 as text), n%10 from ids;
    `);
    createSqliteGtfsIndexes({ database: sqlite });
    sqlite.exec('ANALYZE');
    const matchingStops = database
      .selectFrom('stop_times')
      .innerJoin('trips', (join) =>
        join
          .onRef('trips.source_id', '=', 'stop_times.source_id')
          .onRef('trips.trip_id', '=', 'stop_times.trip_id'),
      )
      .where('trips.route_id', '=', 'rare')
      .select(['stop_times.source_id', 'stop_times.stop_id']);
    const selection = database
      .selectFrom('stops')
      .where('source_id', '=', 'north')
      .where(
        (eb) =>
          sql<boolean>`${eb.refTuple('stops.source_id', 'stops.stop_id')} in (${matchingStops})`,
      )
      .select(['source_id', 'stop_id'])
      .orderBy('stop_id');
    const query = selection.compile();
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(query.parameters) as { detail: string }[];
    const details = plan.map((row) => row.detail).join('\n');
    assert.doesNotMatch(details, /CORRELATED|SCAN /);
    assert.match(details, /SEARCH .*route_id=\?/);
    assert.match(details, /SEARCH .*source_id=\? AND trip_id=\?/);
    assert.match(details, /SEARCH .*source_id=\? AND stop_id=\?/);
    assert.deepEqual(
      sqlite.prepare(query.sql).all(query.parameters),
      Array.from({ length: 10 }, (_, index) => ({
        source_id: 'north',
        stop_id: String(index),
      })),
    );
    const page = selection.limit(4).offset(3).compile();
    assert.deepEqual(
      sqlite.prepare(page.sql).all(page.parameters),
      ['3', '4', '5', '6'].map((stop_id) => ({ source_id: 'north', stop_id })),
    );
  } finally {
    await database.destroy();
  }
});
