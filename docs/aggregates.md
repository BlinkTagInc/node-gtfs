# Summaries and aggregates

[All guides](README.md) · [Query basics](queries.md)

Use reader `count()` for row counts and typed Kysely access for grouped
summaries, field counts, totals, averages, and extrema.

## Count records

```js
const total = await gtfs.schedule.trips.where({ route_id: 'red' }).count();
```

`count()` counts filtered and paginated rows, independently of `select()`.
It returns zero for empty results and rejects counts outside JavaScript's
safe integer range.

## Read SQL numeric results

Kysely's result type annotations do not convert driver values. Drivers can
return SQL counts and aggregates as numbers, strings, or bigints. For exact
integer results, cast to text **in SQL**, then validate before converting:

```js setup
import { sql } from 'kysely';

const integerType = sql.raw(
  gtfs.database.dialect === 'mysql' ? 'char' : 'text',
);

/** @param {unknown} value */
function safeInteger(value) {
  if (
    (typeof value !== 'number' &&
      typeof value !== 'bigint' &&
      typeof value !== 'string') ||
    (typeof value === 'string' && !/^-?\d+$/.test(value))
  ) {
    throw new TypeError('Expected an integer result');
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Integer result is outside the safe range');
  }
  return result;
}
```

The examples below reuse `sql`, `integerType`, and `safeInteger`. Do not
convert `null` to zero: except for counts, an aggregate over no matching
values returns `null`. For fractional results, convert deliberately and
check `Number.isFinite`; keep exact decimal strings when rounding is unacceptable.

## Group records

Count trips by source and route:

```js
const routes = await gtfs.database.withKysely({
  callback: async (database) => {
    const rows = await database
      .selectFrom('trips')
      .where('source_id', '=', 'metro')
      .select(['source_id', 'route_id'])
      .select((eb) =>
        sql`cast(${eb.fn.countAll()} as ${integerType})`.as('trips'),
      )
      .groupBy(['source_id', 'route_id'])
      .orderBy('source_id')
      .orderBy('route_id')
      .execute();
    return rows.map((row) => ({ ...row, trips: safeInteger(row.trips) }));
  },
});
```

Custom SQL does not inherit the instance's source scope. Add source filters
explicitly and include `source_id` in grouping keys when querying multiple
sources. Consume queries inside the callback; do not return a builder to
execute later. Empty grouped results return `[]`.

Use `eb.fn.count('direction_id')` to count non-null field values;
`countAll()` counts rows. `sum`, `avg`, `min`, and `max` ignore nulls.
Monetary storage uses integer minor units: group by currency and choose an
explicit precision policy before calculating monetary totals.

## Summarize a page

To summarize only a page of rows, paginate a subquery before aggregating:

```js
const summary = await gtfs.database.withKysely({
  callback: async (database) => {
    const page = database
      .selectFrom('trips')
      .where('source_id', '=', 'metro')
      .select(['trip_id', 'direction_id'])
      .orderBy('trip_id')
      .offset(20)
      .limit(10);
    const row = await database
      .selectFrom(page.as('page'))
      .select((eb) => [
        sql`cast(${eb.fn.countAll()} as ${integerType})`.as('trips'),
        sql`cast(${eb.fn.count('direction_id')} as ${integerType})`.as(
          'directions',
        ),
        eb.fn.min('trip_id').as('firstTrip'),
      ])
      .executeTakeFirstOrThrow();
    return {
      ...row,
      trips: safeInteger(row.trips),
      directions: safeInteger(row.directions),
    };
  },
});
```

For group pagination, apply `orderBy`, `offset`, and `limit` to the outer
grouped query instead. Filtering, choosing representative rows, paging input,
and paging groups are separate operations. Migrating a reader's
`limit(...).aggregate(...)` to SQL with `LIMIT` on the aggregate itself
would change the result.

## Summarize GTFS times

Use `arrival_service_day_seconds` or `departure_service_day_seconds` for
ranges and extrema. String ordering does not handle both `9:00:00` and
`100:00:00` correctly.

```js
const window = await gtfs.database.withKysely({
  callback: async (database) => {
    const row = await database
      .selectFrom('stop_times')
      .where('source_id', '=', 'metro')
      .where('stop_id', '=', 'central')
      .select((eb) => [
        sql`cast(${eb.fn.min('arrival_service_day_seconds')} as ${integerType})`.as(
          'first',
        ),
        sql`cast(${eb.fn.max('arrival_service_day_seconds')} as ${integerType})`.as(
          'last',
        ),
      ])
      .executeTakeFirstOrThrow();
    /** @param {unknown} value */
    const formatTime = (value) => {
      if (value === null) {
        return null;
      }
      const seconds = safeInteger(value);
      if (seconds < 0) {
        throw new RangeError('Service time must be non-negative');
      }
      return [
        Math.floor(seconds / 3600),
        Math.floor(seconds / 60) % 60,
        seconds % 60,
      ]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
    };
    return { first: formatTime(row.first), last: formatTime(row.last) };
  },
});
```

This returns canonical GTFS strings such as `09:00:00` and `100:00:00`, or
nulls when no times match. Group by the numeric seconds column to combine
equivalent time spellings. These are scheduled service-day times across the
stored static GTFS feed; a service-date filter is a separate condition.

## Next steps

- [Filter the records included in a summary](sql-queries.md).
- [Choose distinct values or representative rows](sql-queries.md#distinct-records).
- [Use direct database queries](sql-queries.md#direct-database-queries).
- [Query a service date or time window](queries.md#query-service-routes-and-stops).
