import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  sql,
  MysqlQueryCompiler,
  PostgresQueryCompiler,
  SqliteDialect,
} from 'kysely';
import {
  createSqliteGtfsTables,
  createSqliteGtfsIndexes,
} from '../../src/database/sqlite/schema-writer.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { compileRepositoryFilters } from '../../src/query/filters.ts';
import { createPortableReadQuery } from '../../src/database/kysely/query/execute.ts';

test('service-date windows fetch stop times by source and active trip without a source-wide scan', async () => {
  const sqlite = new Database(':memory:');
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    createSqliteGtfsTables({ database: sqlite });
    sqlite.exec(`
      with recursive ids(n) as (select 0 union all select n+1 from ids where n<999)
      insert into trips(source_id,trip_id,route_id,service_id)
      select 'north', cast(n as text), 'red', case when n<3 then 'active' else 'inactive' end from ids;
      with recursive ids(n) as (select 0 union all select n+1 from ids where n<99999)
      insert into stop_times(source_id,trip_id,stop_sequence,arrival_time,departure_time)
      select 'north',cast(n/100 as text),n%100,'08:00:00','08:01:00' from ids;
      insert into calendar_dates(source_id,service_id,date,exception_type)
      values ('north','active',20260826,1);
    `);
    createSqliteGtfsIndexes({ database: sqlite });
    const table = compiledTableRegistry.stopTimes;
    const filters = compileRepositoryFilters({
      dialect: 'sqlite',
      table,
      where: {
        serviceDate: 20260826,
      },
    });
    const query = createPortableReadQuery(
      {
        database,
        dialect: 'sqlite',
        table,
        sourceIds: ['north'],
        additionalWhere: filters.additionalWhere,
      },
      {},
    )
      .where('arrival_service_day_seconds', '>=', 25200)
      .where('departure_service_day_seconds', '<=', 36000)
      .select(['trip_id', 'stop_sequence'])
      .compile();
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(query.parameters) as { detail: string }[];
    const stopTimeSteps = plan.filter(({ detail }) =>
      /(?:SCAN|SEARCH) stop_times\b/.test(detail),
    );
    assert.equal(stopTimeSteps.length, 1);
    assert.match(
      stopTimeSteps[0]?.detail ?? '',
      /SEARCH stop_times .*\(source_id=\? AND trip_id=\?\)/,
    );
    const rows = sqlite.prepare(query.sql).all(query.parameters) as {
      trip_id: string;
      stop_sequence: number;
    }[];
    assert.deepEqual(
      rows.sort(
        (a, b) =>
          a.trip_id.localeCompare(b.trip_id) ||
          a.stop_sequence - b.stop_sequence,
      ),
      Array.from({ length: 300 }, (_, index) => ({
        trip_id: String(Math.floor(index / 100)),
        stop_sequence: index % 100,
      })),
    );
    assert.deepEqual(
      filters.relatedTables.map(({ tableName }) => tableName),
      ['trips', 'calendar', 'calendar_dates'],
    );
    for (const compiler of [
      new MysqlQueryCompiler(),
      new PostgresQueryCompiler(),
    ]) {
      const compiled = compiler.compileQuery(query.query, query.queryId);
      assert.deepEqual(compiled.parameters, query.parameters);
      assert.equal(compiled.sql.includes('north'), false);
      assert.equal(compiled.sql.includes('20260826'), false);
    }
  } finally {
    await database.destroy();
  }
});

test('service-date membership preserves null-safe negation, source scope, deduplication and extended hours', async () => {
  const sqlite = new Database(':memory:');
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    // Nullable external storage exercises membership semantics independently
    // of the stricter schema used for imported GTFS records.
    sqlite.exec(`
      create table trips(source_id text, trip_id text, service_id text);
      create table stop_times(source_id text, trip_id text, stop_sequence integer,
        arrival_service_day_seconds integer, departure_service_day_seconds integer);
      create table calendar(source_id text, service_id text, start_date integer,
        end_date integer, wednesday integer);
      create table calendar_dates(source_id text, service_id text, date integer, exception_type integer);
      insert into trips values
        ('north','active','daily'), ('north','removed','removed'),
        ('north','foreign','foreign'), ('north','null-service',null),
        ('north',null,'daily'), ('south','foreign','foreign');
      insert into stop_times values
        ('north','active',1,93600,93660), ('north','removed',2,93600,93660),
        ('north','foreign',3,93600,93660), ('north','null-service',4,93600,93660),
        ('north',null,5,93600,93660), ('north','orphan',6,93600,93660),
        ('south','foreign',7,93600,93660);
      insert into calendar values
        ('north','daily',20260826,20260826,1), ('north','removed',20260826,20260826,1),
        ('south','foreign',20260826,20260826,1), ('north',null,20260826,20260826,1);
      insert into calendar_dates values
        ('north','daily',20260826,1), ('north','removed',20260826,1),
        ('north','removed',20260826,2), ('south','daily',20260826,2);
    `);
    const table = compiledTableRegistry.stopTimes;
    for (const { negate, start, end, expected } of [
      { negate: false, expected: [1] },
      { negate: true, expected: [2, 3, 4, 5, 6] },
      { negate: false, start: 93600, end: 93660, expected: [1] },
      { negate: false, start: 25200, end: 36000, expected: [] },
    ]) {
      const filters = compileRepositoryFilters({
        dialect: 'sqlite',
        table,
        where: { serviceDate: 20260826 },
      });
      const conditions = [...filters.additionalWhere];
      if (negate) {
        conditions.splice(
          0,
          conditions.length,
          sql<boolean>`not (${sql.join(conditions, sql` and `)})`,
        );
      }
      if (start !== undefined && end !== undefined) {
        conditions.push(
          sql<boolean>`arrival_service_day_seconds >= ${start}`,
          sql<boolean>`departure_service_day_seconds <= ${end}`,
        );
      }
      const query = createPortableReadQuery(
        {
          database,
          dialect: 'sqlite',
          table,
          sourceIds: ['north'],
          additionalWhere: conditions,
        },
        {},
      )
        .select('stop_sequence')
        .orderBy('stop_sequence')
        .compile();
      assert.deepEqual(
        sqlite.prepare(query.sql).all(query.parameters),
        expected.map((stop_sequence) => ({ stop_sequence })),
      );
    }
  } finally {
    await database.destroy();
  }
});
