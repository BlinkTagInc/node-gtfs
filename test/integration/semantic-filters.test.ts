import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import Database from 'better-sqlite3';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';
import { resolveQueryWhere } from '../../src/query/equality.ts';
import { compileRepositoryFilters } from '../../src/query/filters.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type { CompiledGtfsTable } from '../../src/schema/compile-table.ts';
test('serviceDate respects exceptions, inclusive dates, weekdays, and source isolation', async (t) => {
  const gtfs = new Gtfs({
    database: {},
    reporting: { level: 'silent' },
  });
  t.after(() => gtfs.close());
  await gtfs.schema.recreate();
  await gtfs.database.withKysely({
    callback: async (database) => {
      for (const serviceId of [
        'daily',
        'removed',
        'inactive',
        'missing',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]) {
        await sql`insert into trips (source_id, route_id, service_id, trip_id)
          values ('north', 'red', ${serviceId}, ${serviceId})`.execute(
          database,
        );
        await sql`insert into stop_times (source_id, trip_id, stop_sequence)
          values ('north', ${serviceId}, 1)`.execute(database);
      }
      await sql`insert into calendar
        (source_id, service_id, monday, tuesday, wednesday, thursday,
         friday, saturday, sunday, start_date, end_date)
        values
          ('north', 'daily', 1, 1, 1, 1, 1, 1, 1, 20260824, 20260830),
          ('north', 'removed', 1, 1, 1, 1, 1, 1, 1, 20260824, 20260830),
          ('north', 'inactive', 0, 0, 0, 0, 0, 0, 0, 20260824, 20260830),
          ('north', 'monday', 1, 0, 0, 0, 0, 0, 0, 20260824, 20260830),
          ('north', 'tuesday', 0, 1, 0, 0, 0, 0, 0, 20260824, 20260830),
          ('north', 'wednesday', 0, 0, 1, 0, 0, 0, 0, 20260824, 20260830),
          ('north', 'thursday', 0, 0, 0, 1, 0, 0, 0, 20260824, 20260830),
          ('north', 'friday', 0, 0, 0, 0, 1, 0, 0, 20260824, 20260830),
          ('north', 'saturday', 0, 0, 0, 0, 0, 1, 0, 20260824, 20260830),
          ('north', 'sunday', 0, 0, 0, 0, 0, 0, 1, 20260824, 20260830),
          ('south', 'missing', 1, 1, 1, 1, 1, 1, 1, 20260824, 20260830)
        `.execute(database);
      await sql`insert into calendar_dates (source_id, service_id, date, exception_type)
        values
          ('north', 'removed', 20260826, 2),
          ('north', 'inactive', 20260826, 1),
          ('north', 'missing', 20260826, 1),
          ('north', 'daily', 20260831, 1),
          ('south', 'daily', 20260824, 2),
          ('south', 'missing', 20260825, 1)
        `.execute(database);
    },
  });
  for (const [date, expected] of [
    [20260823, []],
    [20260824, ['daily', 'monday', 'removed']],
    [20260825, ['daily', 'removed', 'tuesday']],
    [20260826, ['daily', 'inactive', 'missing', 'wednesday']],
    [20260827, ['daily', 'removed', 'thursday']],
    [20260828, ['daily', 'friday', 'removed']],
    [20260829, ['daily', 'removed', 'saturday']],
    [20260830, ['daily', 'removed', 'sunday']],
    [20260831, ['daily']],
    [20260901, []],
  ] as const) {
    await t.test(String(date), async () => {
      const where = { source_id: 'north', serviceDate: date };
      for (const rows of [
        await gtfs.schedule.trips
          .where(where)
          .select('trip_id')
          .orderBy([{ field: 'trip_id', direction: 'asc' }])
          .all(),
        await gtfs.schedule.stopTimes
          .where(where)
          .select('trip_id')
          .orderBy([{ field: 'trip_id', direction: 'asc' }])
          .all(),
      ]) {
        assert.deepEqual(
          rows.map((row) => row.trip_id),
          expected,
        );
      }
      assert.equal(
        await gtfs.schedule.trips.where(where).count(),
        expected.length,
      );
      assert.equal(
        await gtfs.schedule.stopTimes.where(where).count(),
        expected.length,
      );
    });
  }
});
test('equality and semantic filters reject invalid values with structured query errors', async (t) => {
  const cases: readonly {
    table: CompiledGtfsTable;
    fields: readonly string[];
    values: readonly unknown[];
  }[] = [
    {
      table: compiledTableRegistry.trips,
      fields: ['serviceDate'],
      values: [
        2026082,
        202608260,
        20260826.5,
        20260229,
        20260431,
        20261301,
        20260001,
        20260800,
        -20260826,
        NaN,
        Infinity,
        '20260826',
        null,
        true,
        [20260826],
        { equals: 20260826 },
      ],
    },
    {
      table: compiledTableRegistry.stopTimes,
      fields: ['arrival_time', 'departure_time'],
      values: [
        '',
        '09:00',
        '1:2:3:4',
        '-1:00:00',
        '09:60:00',
        '09:00:60',
        '1.5:00:00',
        'abc:00:00',
        '09::00',
        ':00:00',
        '1e2:00:00',
        '0x10:00:00',
        ' 09:00:00',
        '9007199254740991:00:00',
        32400,
        true,
        ['09:00:00'],
        { equals: '09:00:00' },
      ],
    },
    {
      table: compiledTableRegistry.alerts,
      fields: ['communicationActiveAt', 'impactActiveAt'],
      values: [
        -1,
        -1n,
        9223372036854775808n,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
        -Infinity,
        '1700000000',
        null,
        true,
        [1700000000],
        { equals: 1700000000 },
      ],
    },
  ];
  for (const { table, fields, values } of cases) {
    for (const field of fields) {
      for (const value of values) {
        await t.test(
          `${table.tableName}.${field}: ${String(value)} (${typeof value})`,
          () => {
            assert.throws(
              () =>
                compileRepositoryFilters({
                  dialect: 'sqlite',
                  table,
                  where: resolveQueryWhere(table, { [field]: value }),
                }),
              (error: unknown) => {
                assert.ok(isGtfsError(error));
                assert.equal(error.code, GtfsErrorCode.QUERY_INVALID);
                assert.equal(error.details?.table, table.tableName);
                assert.equal(error.details?.field, field);
                if (
                  table.tableName === 'stop_times' &&
                  typeof value === 'object'
                ) {
                  // Operator objects and arrays fail at the equality boundary,
                  // before scalar time-value normalization.
                  assert.match(
                    error.message,
                    /objects support field equality/u,
                  );
                } else {
                  assert.deepEqual(error.details?.value, value);
                }
                return true;
              },
            );
          },
        );
      }
    }
  }
});

test('public semantic filters validate before SQL and accept valid boundary values', async (t) => {
  let statements = 0;
  const sqlite = new Database(':memory:', {
    verbose() {
      statements += 1;
    },
  });
  const gtfs = new Gtfs({
    database: { client: sqlite },
    extensions: ['gtfs-realtime'],
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    await gtfs.close();
    sqlite.close();
  });
  await gtfs.schema.ensure();
  for (const terminal of [
    () => gtfs.schedule.trips.where({ serviceDate: 20260229 }).all(),
    () => gtfs.schedule.trips.where({ serviceDate: 20260229 }).first(),
    () => gtfs.schedule.trips.where({ serviceDate: 20260229 }).count(),
    () => gtfs.realtime.alerts.where({ communicationActiveAt: -1 }).all(),
    () => gtfs.realtime.alerts.where({ impactActiveAt: 0.5 }).first(),
  ]) {
    statements = 0;
    await assert.rejects(async () => terminal(), {
      code: GtfsErrorCode.QUERY_INVALID,
    });
    assert.equal(statements, 0);
  }
  // Keep valid edge values alongside rejections so stricter checks stay precise.
  assert.deepEqual(
    await gtfs.schedule.trips.where({ serviceDate: 20240229 }).all(),
    [],
  );
  for (const field of ['arrival_time', 'departure_time'] as const) {
    for (const value of ['25:30:00', null]) {
      assert.deepEqual(
        await gtfs.schedule.stopTimes.where({ [field]: value }).all(),
        [],
      );
    }
  }
  for (const field of ['communicationActiveAt', 'impactActiveAt'] as const) {
    for (const value of [
      0,
      0n,
      Number.MAX_SAFE_INTEGER,
      BigInt(Number.MAX_SAFE_INTEGER),
    ]) {
      assert.deepEqual(
        await gtfs.realtime.alerts.where({ [field]: value }).all(),
        [],
      );
    }
  }
});
