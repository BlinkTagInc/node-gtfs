# Query data

[All guides](README.md)

A **repository** is the object you use to read one kind of record. For example,
`gtfs.schedule.routes` reads `routes.txt` records and `gtfs.schedule.stopTimes`
reads `stop_times.txt` records.

Examples below assume an open `gtfs` instance pointing to an imported database.
See [getting started](getting-started.md) for a complete runnable script.

## Find records

```js
const routes = await gtfs.schedule.routes.all();
const route = await gtfs.schedule.routes.first({ route_id: 'red' });
```

`all()` immediately starts an array read and returns a normal `Promise<Row[]>`.
`first()` returns one row or `null`; an empty `all()` result is `[]`. Without
`orderBy()`, row order and which matching row is first are not guaranteed.

To require a match, call `firstOrThrow()` on the reader:

```js
const route = await gtfs.schedule.routes.firstOrThrow({ route_id: 'red' });
```

Both first-row methods fetch at most one row and respect the reader's offset
and limit, including `limit(0)`. `firstOrThrow()` throws `GTFS_QUERY_INVALID`
with reason `NO_ROWS` when nothing matches. Use `first()` when no match should
return `null`.

Repositories are read-only. Use [import](import.md) to load data and
[direct database access](sql-queries.md#direct-database-queries) for custom SQL.

## Query service, routes, and stops

Use `gtfs.query` for common GTFS operations:

```js
const trips = await gtfs.query
  .activeTrips({
    serviceDate: 20260922,
    routeId: 'red',
  })
  .all();

const stops = await gtfs.query
  .stopsForRoute({
    routeId: 'red',
    serviceDate: 20260922,
    useParentStation: true,
  })
  .select('source_id', 'stop_id', 'stop_name')
  .orderBy([{ field: 'stop_name' }])
  .all();

const departures = gtfs.query.stopTimes({
  serviceDate: 20260922,
  routeId: 'red',
  stopId: 'platform',
  window: { field: 'departure_time', start: '25:00:00', end: '26:00:00' },
});
const departureCount = await departures.count();
```

`activeTrips` and `stopTimes` require a numeric `YYYYMMDD` service date.
They apply weekday schedules and `calendar_dates` additions and removals.
`routeId` is optional for both; `stopId` is optional for `stopTimes`.
`stopsForRoute` requires `routeId` and accepts an optional service date.
All IDs match within the instance's source scope. Add
`.where({ source_id: 'north' })` to narrow a multi-source result.

Time windows include `start` and exclude `end`. Choose `arrival_time` or
`departure_time`; extended hours such as `25:00:00` are supported. The end must
not precede the start. Missing times do not match a window. Results are stored
schedule rows: frequency expansion, interpolation, and GTFS-Realtime adjustments
are not applied.

For geographic stop selection, use
`gtfs.query.stops({ withinBounds: { south, west, north, east } })`.
Bounds include their edges and support crossing the antimeridian.
Both stop helpers default `useParentStation` to `false`, excluding stations.
Set it to `true` to replace children with valid parent stations and retain
standalone stops. Children with missing parents or parents without valid
coordinates are omitted. Boarding areas resolve through their platform.
Route and bounds selection happens before parent resolution; a returned parent
can lie outside the bounds. Results are deduplicated by source and stop ID.
Ordinary `gtfs.schedule.stops` queries return raw stop records.

Readers returned by `gtfs.query` support equality and semantic `where()`
filters, `select()`, `orderBy([{ field, direction }])`, `limit()`, `offset()`,
`count()`, `all()`, and `first()`. Ordering defaults to `asc`; `desc` reverses it.
Refinements, sorting, counts, and paging apply to resolved stop rows.
`count()` counts the filtered and paginated input, regardless of projection;
it rejects results outside JavaScript's safe integer range. Use
[direct Kysely access](sql-queries.md#direct-database-queries) for arbitrary joins,
comparisons, and aggregates. That access uses stored values and requires you
to apply source filtering yourself.

## Build a query

```js
const routes = await gtfs.schedule.routes
  .where({ route_type: 3 })
  .select('route_id', 'route_short_name')
  .orderBy([{ field: 'route_short_name', direction: 'asc' }])
  .limit(20)
  .all();
```

Read this as: bus routes, those two fields, sorted by short name, at most
20 records. `route_type: 3` is a GTFS field value, not a node-GTFS option.

| Method                            | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `where(filter)`                   | Restrict which rows match.                                |
| `select(...fields)`               | Return only named fields. At least one field is required. |
| `orderBy([{ field, direction }])` | Sort by fields; direction defaults to `asc`.              |
| `limit(number)`                   | Maximum rows to return; `0` returns no rows.              |
| `offset(number)`                  | Skip this many rows.                                      |
| `count()`                         | Count the filtered and paginated rows.                    |
| `all()`                           | Start an array read; return a Promise.                    |
| `first(filter?)`                  | Get one matching row or `null`.                           |
| `firstOrThrow(filter?)`           | Get one matching row or throw when none match.            |
| `stream()`                        | Return a lazy, single-use async iterator.                 |

`limit` and `offset` require non-negative safe integers. Duplicate or unknown
selection fields are errors. See [filters](query-filters.md) for comparisons,
dates, and related records.

## Reuse queries safely

Queries are immutable: each builder method returns a new query. Repeated
`where()` calls add conditions; repeated `select()`, `orderBy()`, `limit()`, and
`offset()` calls replace that setting.

```js
const busRoutes = gtfs.schedule.routes.where({ route_type: 3 });

const firstPage = await busRoutes
  .orderBy([{ field: 'route_id', direction: 'asc' }])
  .limit(20)
  .all();

const agencyRoutes = await busRoutes
  .where({ agency_id: 'metro' })
  .select('route_id', 'route_short_name')
  .all();
```

Calling `first(filter)` adds its filter to the existing query. It respects
the existing offset and a limit of zero.

## Sorting and pages

```js
const trips = await gtfs.schedule.trips
  .orderBy([
    { field: 'route_id', direction: 'asc' },
    { field: 'trip_id', direction: 'asc' },
  ])
  .offset(20)
  .limit(20)
  .all();
```

Use enough sort fields to break ties for predictable pages. If multiple
sources are in scope, include `source_id` where necessary. Nullable fields
follow the database’s default null ordering. `direction` accepts `asc` (the
default) or `desc`. `orderBy([])` clears row ordering. Replace old sorting callbacks such
as `orderBy(row => row.trip_id.asc())` with `orderBy([{ field: 'trip_id' }])`.

## Count matching rows

```js
const trips = gtfs.schedule.trips.where({ route_id: 'red' });
const total = await trips.count();
const pageSize = await trips
  .orderBy([{ field: 'trip_id' }])
  .offset(20)
  .limit(10)
  .count();
```

`count()` returns a `Promise<number>`. It counts the filtered input after
pagination, independently of `select()`.
Empty queries and `limit(0)` return zero. Unsafe integer counts are rejected.
Each call executes against the current database and instance source scope.
For a total across all pages, call `count()` on the query before adding paging.

For field counts, grouped summaries, totals, and extrema, use
[typed SQL summaries](aggregates.md). Reader `aggregate()` and `groupBy()`
are no longer supported.

## Distinct records

Use [custom SQL](sql-queries.md#distinct-records) to return unique values or
choose one representative row per key. The examples cover `DISTINCT`, window
functions, ordering, and pagination.

## Read large results a row at a time

Use `stream()` to read rows without collecting the whole result in application
memory. It returns a single-use async iterator and starts the read when iteration
begins:

```js
for await (const row of gtfs.schedule.stopTimes
  .select('trip_id', 'stop_id', 'arrival_time')
  .stream()) {
  console.log(row.trip_id, row.stop_id, row.arrival_time);
}
```

SQLite and MySQL work with their configured connections; PostgreSQL needs
[cursor configuration](databases.md#postgresql). Sorting may still require
database-side work and temporary space.

Breaking the loop or throwing from it releases the stream. If you use `next()`
manually, call `return()` in a `finally` block when stopping early. Closing or
disposing the instance also releases its active streams. An exhausted or returned
iterator stays done; call `stream()` again for a fresh read.

Each `all()`, `first()`, `firstOrThrow()`, or `count()` call starts a new operation.
Awaiting the same array Promise again returns its original result; calling
`all()` again reads current data. Calling `stream()` alone does not reserve a
connection or execute SQL.

For callers migrating from the combined result API:

| Previous call                          | Current call                              |
| -------------------------------------- | ----------------------------------------- |
| `await query.all()`                    | `await query.all()`                       |
| `query.all().toArray()`                | `query.all()`                             |
| `for await (const row of query.all())` | `for await (const row of query.stream())` |
| `query.limit(1).all().firstOrThrow()`  | `query.firstOrThrow()`                    |

Use `Promise<Row[]>` for arrays and `AsyncIterableIterator<Row>` for streams.
The combined `AsyncIterableResult` type is no longer exported.

For SQLite or a borrowed transaction, finish the stream before starting another
operation on the same instance. PostgreSQL/MySQL pools can support other reads
while streaming if connections are available. Writes and custom SQL callbacks
require all active streams to finish. See
[operation coordination and pool limits](databases.md#connection-ownership-and-closing).

## Returned values and TypeScript

GTFS field names retain their spelling: `route_id`, `stop_sequence`, and
`fare_product_id`. Repository names use camelCase: `stopTimes`, `calendarDates`.

| Data                    | Repository representation                                        |
| ----------------------- | ---------------------------------------------------------------- |
| Identifiers             | Strings; leading zeros are preserved.                            |
| Missing optional values | Usually `null`; fields with a declared default use that default. |
| Schedule dates          | Numbers such as `20260914`.                                      |
| Schedule times          | Strings such as `"25:15:00"`.                                    |
| Monetary amounts        | Exact decimal strings such as `"2.50"`.                          |
| JSON-valued fields      | JSON text; parse with `JSON.parse()` when needed.                |
| Source identity         | `source_id` on each row.                                         |

Default selections exclude `_unknown_fields` and derived Schedule time columns.
Select `arrival_service_day_seconds` explicitly when you need numeric seconds.
See [time filters](query-filters.md#dates-and-service-day-times).

TypeScript infers selected fields:

```ts
import type { Gtfs, Routes } from 'gtfs';

async function listRoutes(gtfs: Gtfs): Promise<Routes[]> {
  return await gtfs.schedule.routes.all();
}
```

Filename-based types such as `Routes`, `StopTimes`, and `Calendar` describe
default repository rows. `GtfsStoredTableRow<'stop_times'>` describes a direct
database row, not the default repository result.

## Empty results versus errors

An enabled empty table returns an empty result. A disabled extension rejects
with `GTFS_EXTENSION_DISABLED`. Missing or incompatible tables required by a
query reject with `GTFS_SCHEMA_INVALID`. These are not interchangeable.

## Next steps

- [Filter by times, dates, or related records](query-filters.md).
- [Write SQL comparisons, text searches, and joins](sql-queries.md).
- [Count trips and summarize service](aggregates.md).
- [Create map features](geojson.md).
- [Look up repository fields and row types](data-model.md).
- [Query current GTFS-Realtime records](realtime.md#query-current-records).
