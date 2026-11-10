import { createDummyDialect } from '../helpers/kysely-dialect.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Kysely, sql } from 'kysely';

import { Gtfs, GtfsErrorCode } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import {
  executePortableFindMany,
  createPortableReadQuery,
  type PortableFindManyOptions,
} from '../../src/database/kysely/query/execute.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';
import type { GtfsDatabaseDialect } from '../../src/database/dialects.ts';
import { compileRepositoryFilters } from '../../src/query/filters.ts';
import type { CompiledGtfsTable } from '../../src/schema/compile-table.ts';
import { activeTripKeys } from '../helpers/advanced-filter-recipes.ts';
import { integerText } from '../helpers/advanced-summary-recipes.ts';
import { executePortableCount } from '../../src/database/kysely/query/count.ts';
import { resolveQueryWhere } from '../../src/query/equality.ts';

async function read(
  gtfs: Gtfs,
  table: FileBackedCompiledGtfsTable,
  options: PortableFindManyOptions = {},
): Promise<Record<string, unknown>[]> {
  return gtfs.database.withKysely({
    callback: (database) =>
      executePortableFindMany(
        {
          database,
          dialect: gtfs.database.dialect,
          table,
          sourceIds: gtfs.sourceIds,
          additionalWhere: compileRepositoryFilters({
            dialect: gtfs.database.dialect,
            table,
            where: options.where,
          }).additionalWhere,
        },
        { ...options, where: {} },
      ),
  });
}

async function executeRepositoryFilterQuery(
  database: Kysely<GtfsDatabase>,
  dialect: GtfsDatabaseDialect,
  table: CompiledGtfsTable,
  where: Readonly<Record<string, unknown>>,
  select: readonly string[],
): Promise<readonly CompiledGtfsTable[]> {
  const filters = compileRepositoryFilters({ dialect, table, where });
  await executePortableFindMany(
    {
      database,
      dialect,
      table,
      sourceIds: ['north'],
      additionalWhere: filters.additionalWhere,
    },
    {
      select,
    },
  );
  return filters.relatedTables;
}

describe('portable Kysely read layer', () => {
  test('compiles aggregates and same-row references with each dialect compiler using dummy drivers', async () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const queries: {
        readonly sql: string;
        readonly parameters: readonly unknown[];
      }[] = [];
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event.query);
          }
        },
      });
      try {
        const query = database
          .selectFrom('stop_times')
          .where('source_id', '=', 'north')
          .whereRef(
            'departure_service_day_seconds',
            '>',
            'arrival_service_day_seconds',
          )
          .where((eb) =>
            eb.exists(
              eb
                .selectFrom(activeTripKeys(database, 20260912).as('active'))
                .select('active.trip_id')
                .whereRef('active.source_id', '=', 'stop_times.source_id')
                .whereRef('active.trip_id', '=', 'stop_times.trip_id'),
            ),
          )
          .select(['source_id', 'trip_id'])
          .select((eb) => [
            integerText(eb.fn.countAll(), dialect).as('total'),
            integerText(eb.fn.min('arrival_service_day_seconds'), dialect).as(
              'earliest',
            ),
            integerText(eb.fn.max('departure_service_day_seconds'), dialect).as(
              'latest',
            ),
          ])
          .groupBy(['source_id', 'trip_id'])
          .orderBy('trip_id')
          .limit(10)
          .offset(2)
          .compile();
        assert.equal(queries.length, 0);
        assert.match(query.sql, /count\(\*\)/i);
        assert.match(query.sql, /min\([`"]arrival_service_day_seconds[`"]\)/i);
        assert.match(
          query.sql,
          /max\([`"]departure_service_day_seconds[`"]\)/i,
        );
        assert.match(
          query.sql,
          /[`"]departure_service_day_seconds[`"] > [`"]stop_times[`"]\.[`"]arrival_service_day_seconds[`"]|[`"]departure_service_day_seconds[`"] > [`"]arrival_service_day_seconds[`"]/i,
        );
        assert.match(query.sql, /group by [`"]source_id[`"], [`"]trip_id[`"]/i);
        assert(query.parameters.includes('north'));
        assert(query.parameters.includes(20260912));
        assert(!query.parameters.includes('arrival_time'));
        assert(!query.sql.includes('sqlite_master'));
      } finally {
        await database.destroy();
      }
    }
  });

  for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
    test(`${dialect} compiles sums and averages over paginated input using a dummy driver`, async () => {
      const queries: string[] = [];
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event.query.sql);
          }
        },
      });
      try {
        const input = database
          .selectFrom('stop_times')
          .where('source_id', '=', 'north')
          .select(['trip_id', 'stop_sequence', 'arrival_service_day_seconds'])
          .orderBy('trip_id')
          .limit(3);
        const query = database
          .selectFrom(input.as('input'))
          .select('trip_id')
          .select((eb) => [
            integerText(eb.fn.sum('stop_sequence'), dialect).as('total'),
            integerText(eb.fn.avg('arrival_service_day_seconds'), dialect).as(
              'average',
            ),
          ])
          .groupBy('trip_id')
          .compile()
          .sql.replaceAll('`', '"');
        assert.equal(queries.length, 0);
        assert.match(query, /cast\(sum\("stop_sequence"\) as (?:text|char)\)/);
        assert.match(
          query,
          /cast\(avg\("arrival_service_day_seconds"\) as (?:text|char)\)/,
        );
        assert.match(query, /limit .*\) as "input" group by "trip_id"/);
      } finally {
        await database.destroy();
      }
    });
    test(`${dialect} compiles equality predicates and numeric time ordering without schema inspection`, async () => {
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
      });
      try {
        const table = compiledTableRegistry.stopTimes;
        const where = resolveQueryWhere(table, { arrival_time: '25:00:00' });
        const { additionalWhere } = compileRepositoryFilters({
          table,
          dialect,
          where,
        });
        const orderBy = [
          { field: 'trip_id', direction: 'asc' },
          { field: 'arrival_time', direction: 'desc' },
        ] as const;
        const compiled = createPortableReadQuery(
          { database, dialect, table, sourceIds: ['north'], additionalWhere },
          { orderBy, limit: 10, offset: 2 },
        )
          .select('trip_id')
          .compile();
        assert.match(compiled.sql, /arrival_service_day_seconds/);
        assert.equal(compiled.sql.includes('north'), false);
        assert.equal(compiled.parameters.includes(90000), true);
        assert.equal(compiled.parameters.includes('north'), true);
      } finally {
        await database.destroy();
      }
    });
    test(`${dialect} predicate compilation rejects undefined without executing SQL`, async () => {
      let queryCount = 0;
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log() {
          queryCount += 1;
        },
      });
      const context = {
        database,
        dialect,
        table: compiledTableRegistry.routes,
        sourceIds: null,
      };
      try {
        for (const value of [
          undefined,
          [undefined],
          ['red', undefined],
          [null, undefined],
          new Array(1),
        ]) {
          const options = { where: { route_id: value } } as never;
          await assert.rejects(executePortableFindMany(context, options), {
            code: 'GTFS_QUERY_INVALID',
          });
          await assert.rejects(executePortableCount(context, options), {
            code: 'GTFS_QUERY_INVALID',
          });
        }
        assert.equal(queryCount, 0);
      } finally {
        await database.destroy();
      }
    });
  }
  test('materializes scoped filtering, projections, ordering, and pagination', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: async (database) => {
          await sql`insert into stop_times
            (source_id, trip_id, arrival_time, stop_id, stop_sequence)
            values
              ('north', 'trip-a', '08:30:00', null, 1),
              ('north', 'trip-b', '09:05:00', 'stop-2', 2),
              ('north', 'trip-c', null, 'stop-3', 3),
              ('south', 'trip-d', '07:00:00', null, 1)`.execute(database);
        },
      });

      const defaultRows = await read(gtfs, compiledTableRegistry.stopTimes, {
        orderBy: [{ field: 'stop_sequence' }],
      });
      assert.equal(defaultRows.length, 3);
      assert.equal('arrival_service_day_seconds' in defaultRows[0]!, false);
      assert.equal('_unknown_fields' in defaultRows[0]!, false);
      assert.equal(defaultRows[0]!.source_id, 'north');

      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.stopTimes, {
          where: { stop_id: 'stop-2' },
          select: ['trip_id', 'stop_id'],
          orderBy: [{ field: 'stop_sequence', direction: 'asc' }],
        }),
        [{ trip_id: 'trip-b', stop_id: 'stop-2' }],
      );

      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.stopTimes, {
          where: { arrival_time: '09:05:00' },
          select: ['trip_id', 'arrival_time', 'arrival_service_day_seconds'],
          orderBy: [
            { field: 'arrival_service_day_seconds', direction: 'desc' },
          ],
          limit: 1,
          offset: 0,
        }),
        [
          {
            trip_id: 'trip-b',
            arrival_time: '09:05:00',
            arrival_service_day_seconds: 32_700,
          },
        ],
      );

      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.stopTimes, {
          where: { stop_id: null },
          select: ['trip_id'],
        }),
        [{ trip_id: 'trip-a' }],
      );

      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.stopTimes, {
          select: ['trip_id', 'stop_sequence'],
          orderBy: [{ field: 'stop_sequence', direction: 'asc' }],
          limit: 1,
          offset: 1,
        }),
        [{ trip_id: 'trip-b', stop_sequence: 2 }],
      );
    } finally {
      await gtfs.close();
    }
  });

  test('preserves portable date, time, null, and exact monetary values', async () => {
    const gtfs = new Gtfs({
      database: {},
      sources: [{ sourceId: 'test' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      await gtfs.database.withKysely({
        callback: async (database) => {
          await sql`insert into calendar_dates
            (source_id, service_id, date, exception_type)
            values ('test', 'weekday', 20260826, 1)`.execute(database);
          await sql`insert into fare_attributes
            (source_id, fare_id, price, currency_type, payment_method)
            values ('test', 'day-pass', ${1234n}, 'USD', 0)`.execute(database);
        },
      });

      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.calendarDates, {
          where: { date: 20260826 },
          select: ['service_id', 'date'],
        }),
        [{ service_id: 'weekday', date: 20260826 }],
      );
      assert.deepEqual(
        await read(gtfs, compiledTableRegistry.fareAttributes, {
          where: { price: '12.34', currency_type: 'USD' },
          select: ['fare_id', 'price'],
        }),
        [{ fare_id: 'day-pass', price: '12.34' }],
      );
    } finally {
      await gtfs.close();
    }
  });

  test('rejects storage fields and invalid portable query controls', async () => {
    const gtfs = new Gtfs({ database: {} });
    try {
      for (const options of [
        { select: ['_unknown_fields'] },
        { orderBy: [{ field: 'missing' }] },
        { limit: -1 },
      ] satisfies PortableFindManyOptions[]) {
        await assert.rejects(
          read(gtfs, compiledTableRegistry.routes, options),
          (error: unknown) =>
            (error as { code?: unknown }).code === GtfsErrorCode.QUERY_INVALID,
        );
      }
      await assert.rejects(
        read(gtfs, compiledTableRegistry.routes, {
          orderBy: [{ field: 'route_id', direction: 'ASC' }],
        } as never),
        (error: unknown) => {
          const candidate = error as {
            code?: unknown;
            details?: Record<string, unknown>;
          };
          return (
            candidate.code === GtfsErrorCode.QUERY_INVALID &&
            candidate.details?.direction === 'ASC' &&
            Array.isArray(candidate.details?.expectedDirections)
          );
        },
      );
    } finally {
      await gtfs.close();
    }
  });

  test('compiles parameterized SQL with SQLite, PostgreSQL, and MySQL compilers using dummy drivers', async () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const queries: Array<{ sql: string; parameters: readonly unknown[] }> =
        [];
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event.query);
          }
        },
      });
      try {
        const rows = await executePortableFindMany(
          {
            database,
            dialect,
            table: compiledTableRegistry.routes,
            sourceIds: ['north', 'south'],
          },
          {
            where: { agency_id: 'agency' },
            select: ['source_id', 'route_id', 'route_short_name'],
            orderBy: [{ field: 'route_short_name', direction: 'desc' }],
            limit: 5,
            offset: 2,
          },
        );
        assert.deepEqual(rows, []);
        assert.equal(queries.length, 1);
        assert.match(queries[0]!.sql, /agency_id/);
        assert.match(queries[0]!.sql, /agency_id.*=/);
        assert.match(queries[0]!.sql, /order by.*route_short_name.*desc/);
        assert.deepEqual(queries[0]!.parameters.slice(0, 3), [
          'north',
          'south',
          'agency',
        ]);
      } finally {
        await database.destroy();
      }
    }
  });

  test('compiles default and derived aliases with each dialect compiler using dummy drivers', async () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const queries: string[] = [];
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event.query.sql);
          }
        },
      });
      try {
        await executePortableFindMany(
          {
            database,
            dialect,
            table: compiledTableRegistry.stopTimes,
            sourceIds: null,
          },
          {},
        );
        await executePortableFindMany(
          {
            database,
            dialect,
            table: compiledTableRegistry.stopTimes,
            sourceIds: null,
          },
          { select: ['trip_id', 'arrival_service_day_seconds'] },
        );

        assert.equal(queries.length, 2);
        assert.doesNotMatch(queries[0]!, /arrival_service_day_seconds/);
        assert.doesNotMatch(queries[0]!, /_unknown_fields|_node_gtfs/);
        assert.match(
          queries[1]!,
          /arrival_service_day_seconds.*arrival_service_day_seconds/,
        );
      } finally {
        await database.destroy();
      }
    }
  });

  test('compiles repository extension filters with each dialect compiler using dummy drivers', async () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const queries: string[] = [];
      const database = new Kysely<GtfsDatabase>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event.query.sql);
          }
        },
      });
      try {
        await executeRepositoryFilterQuery(
          database,
          dialect,
          compiledTableRegistry.trips,
          { serviceDate: 20260826 },
          ['trip_id'],
        );
        await executeRepositoryFilterQuery(
          database,
          dialect,
          compiledTableRegistry.alerts,
          {
            communicationActiveAt: 1_700_000_000,
          },
          ['entity_id'],
        );
        await executeRepositoryFilterQuery(
          database,
          dialect,
          compiledTableRegistry.stopTimes,
          {
            stop_id: 'stop',
            arrival_time: '15:58:00',
          },
          ['trip_id'],
        );
        await executeRepositoryFilterQuery(
          database,
          dialect,
          compiledTableRegistry.stops,
          {
            withinBounds: {
              south: -10,
              west: 170,
              north: 10,
              east: -170,
            },
          },
          ['stop_id'],
        );
        assert.equal(queries.length, 4);
        assert.match(queries[0]!, /calendar_dates/);
        assert.match(queries[1]!, /alert_time_ranges/);
        assert.match(queries[1]!, /start_unix_seconds.*<=/s);
        assert.match(queries[1]!, /end_unix_seconds.*>/s);
        assert.match(queries[2]!, /arrival_service_day_seconds.*=/s);
        assert.doesNotMatch(queries[2]!, /departure_service_day_seconds/);
        assert.match(queries[3]!, /stop_lat.*>=.*stop_lat.*<=/s);
        assert.match(queries[3]!, /stop_lon.*>=.*or.*stop_lon.*<=/s);
      } finally {
        await database.destroy();
      }
    }
  });
});
