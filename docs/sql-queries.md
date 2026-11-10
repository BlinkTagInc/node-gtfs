# Custom SQL queries

[All guides](README.md) · [Query basics](queries.md)

Use `gtfs.database.withKysely()` for custom filters, joins, and distinct records
beyond the repository API. Its callback receives a typed Kysely database.

- [Direct database queries and connection rules](#direct-database-queries)
- [Comparisons and missing values](#comparisons-and-missing-values)
- [Service-day times and field comparisons](#service-day-times-and-field-comparisons)
- [Joining related records](#joining-related-records)
- [Filtering by related records](#related-records)
- [Case-sensitive text search](#case-sensitive-text-search)
- [Unicode-insensitive literal search](#unicode-insensitive-literal-search)
- [Monetary comparisons](#monetary-comparisons)
- [Combining service dates with custom SQL](#combining-service-dates-with-custom-sql)
- [Distinct records and representative rows](#distinct-records)

## Direct database queries

Use this when you need joins or expressions outside the repository API:

```js
const rows = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('trips')
      .select(['route_id', 'trip_id'])
      .where('source_id', '=', 'metro')
      .execute(),
});
```

The callback receives a Kysely database for any supported backend. It does
**not** automatically add source filters, validate tables, or convert stored
values into public repository values. Include `source_id` in filters and
joins; GTFS-Realtime joins can also require `realtime_feed_id`.

Use [stored row types and schema metadata](data-model.md) for this layer. Monetary
columns contain integer minor units, not repository decimal strings. Do not
destroy the supplied database inside the callback.

SQL bypasses reader value validation and schema preflight. Use fixed column
references and bound values for user input, never `sql.raw(userInput)`.

Await or fully consume all SQL work before the callback returns. Returning a
builder or cursor to execute later escapes the managed connection lifetime.
The callback is exclusive within this instance but does not automatically start
a transaction or reserve a single pool connection. Use Kysely's
`database.transaction().execute(...)` or `database.connection().execute(...)`
inside it when needed, and use the supplied transaction/connection for all work
in that scope. Do not await another operation on the same `Gtfs` instance inside
the callback; that operation waits for the callback to finish.

## Comparisons and missing values

```js
const stops = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stops')
      .select(['stop_id', 'stop_name'])
      .where('source_id', '=', 'metro')
      .where((eb) =>
        eb.or([
          eb('parent_station', 'is', null),
          eb('parent_station', '=', 'central'),
        ]),
      )
      .orderBy('stop_id')
      .execute(),
});
```

Chained `where()` calls combine with AND. Use Kysely's `eb.and()`, `eb.or()`,
and `eb.not()` for boolean expressions. JavaScript `&&`, `||`, and `!` do not
build SQL conditions.

Use `is` / `is not` with `null`; `!=` and `not in` exclude null values. Add an
explicit null branch when those rows should match. Omit optional conditions
instead of binding `undefined`.

Handle empty membership arrays explicitly for portable SQL:

```js
const ids = ['central', 'market'];
const rows = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stops')
      .select('stop_id')
      .where('source_id', '=', 'metro')
      .where((eb) => (ids.length === 0 ? eb.or([]) : eb('stop_id', 'in', ids)))
      .execute(),
});
```

`eb.or([])` is false and `eb.and([])` is true. For an empty exclusion list,
omit the `not in` condition or use `eb.and([])`.

## Service-day times and field comparisons

Compare generated second columns, including when comparing two time fields:

```js
const dwellTimes = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stop_times')
      .select(['trip_id', 'arrival_time', 'departure_time'])
      .where('source_id', '=', 'metro')
      .whereRef(
        'departure_service_day_seconds',
        '>',
        'arrival_service_day_seconds',
      )
      .execute(),
});
```

For arrivals after midnight, use
`.where('arrival_service_day_seconds', '>=', 86400)`. Sorting and comparing the
text `arrival_time` column will not order all GTFS times correctly, including
`100:00:00`. Null times do not satisfy ordinary comparisons.

For active service dates and arrival windows, use the
[domain operations](queries.md#query-service-routes-and-stops); they handle calendar
exceptions and source-aware service selection.

## Joining related records

Use `gtfs.database.withKysely()` for joins and related-record predicates. Add
`source_id` to every relationship key. GTFS-Realtime child records also need their
GTFS-Realtime feed identity, and retained message entities need their snapshot identity.

| Relationship              | Join keys                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| Trip → route              | `source_id`, `trips.route_id = routes.route_id`                        |
| Stop time → trip          | `source_id`, `stop_times.trip_id = trips.trip_id`                      |
| Child stop → parent       | `source_id`, `child.parent_station = parent.stop_id`                   |
| Selector → alert          | `source_id`, `realtime_feed_id`, `selector.alert_id = alert.entity_id` |
| Message entity → snapshot | `source_id`, `realtime_feed_id`, `snapshot_id`                         |

For example, select stop times on a route without requiring a service date:

```js
const times = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stop_times as time')
      .innerJoin('trips as trip', (join) =>
        join
          .onRef('trip.source_id', '=', 'time.source_id')
          .onRef('trip.trip_id', '=', 'time.trip_id'),
      )
      .where('time.source_id', '=', 'metro')
      .where('trip.route_id', '=', 'red')
      .select(['time.trip_id', 'time.stop_id', 'time.arrival_time'])
      .execute(),
});
```

When filtering through a one-to-many relationship, use `EXISTS` to avoid
multiplying the outer rows. See [related-record examples](#related-records)
for existence, absence, every-match semantics, nullable keys, and GTFS-Realtime feeds.

For common service-date and route lookups, use the
[GTFS domain queries](queries.md#query-service-routes-and-stops).

## Related records

Use a correlated `EXISTS` subquery to filter without multiplying rows:

```js
const routes = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('routes')
      .select('route_id')
      .where('source_id', '=', 'metro')
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('trips')
            .select('trip_id')
            .whereRef('trips.source_id', '=', 'routes.source_id')
            .whereRef('trips.route_id', '=', 'routes.route_id')
            .where('direction_id', '=', 0),
        ),
      )
      .execute(),
});
```

Always correlate `source_id` as well as the GTFS ID. An absent parent, null
reference, or parent found only in another source does not match.

| Reader relationship | SQL equivalent                                  |
| ------------------- | ----------------------------------------------- |
| `some(predicate)`   | `EXISTS (related rows WHERE predicate)`         |
| `none(predicate)`   | `NOT EXISTS (related rows WHERE predicate)`     |
| `every(predicate)`  | `NOT EXISTS (related rows WHERE NOT predicate)` |

For `none`, wrap `eb.exists(...)` in `eb.not(...)`. For `every`, negate the
predicate inside the subquery, then negate the existence check. Both `none`
and `every` match when there are no related rows. Add another existence check
when at least one related row is required.

An ordinary comparison against a null related value is SQL UNKNOWN;
`NOT UNKNOWN` also stays UNKNOWN. Such a row does not violate the `every`
recipe. If missing values should fail, include `field IS NULL` in the
subquery's violation condition.

GTFS-Realtime parent/child queries also need the GTFS-Realtime feed identity:

```js
const alerts = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('alerts')
      .select('entity_id')
      .where('source_id', '=', 'metro')
      .where('realtime_feed_id', '=', 'alerts-feed')
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('alert_entity_selectors as selector')
            .select('selector.alert_id')
            .whereRef('selector.source_id', '=', 'alerts.source_id')
            .whereRef(
              'selector.realtime_feed_id',
              '=',
              'alerts.realtime_feed_id',
            )
            .whereRef('selector.alert_id', '=', 'alerts.entity_id')
            .where('selector.stop_id', '=', 'central'),
        ),
      )
      .execute(),
});
```

For joins that return related fields, use the same identity columns in the
join condition. Multiple matching children can then produce multiple rows.

## Case-sensitive text search

On node-GTFS-created tables, use SQLite GLOB or PostgreSQL/MySQL LIKE for a
case-sensitive literal substring. Escape each backend's metacharacters:

```js
import { sql } from 'kysely';

const search = 'Market';
const glob = `*${search.replace(/[[*?]/g, (character) => `[${character}]`)}*`;
const like = `%${search.replace(/[!%_]/g, '!$&')}%`;
const stops = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stops')
      .select(['stop_id', 'stop_name'])
      .where('source_id', '=', 'metro')
      .where((eb) =>
        gtfs.database.dialect === 'sqlite'
          ? sql`${eb.ref('stop_name')} glob ${glob}`
          : sql`${eb.ref('stop_name')} like ${like} escape '!'`,
      )
      .execute(),
});
```

The PostgreSQL/MySQL examples rely on the binary collations installed by
node-GTFS. Custom tables or changed collations can behave differently. GLOB
uses `*` / `?` as wildcards; LIKE uses `%` / `_`. For example, a case-sensitive
prefix pattern is `Market*` in SQLite and `Market%` in PostgreSQL/MySQL.
Use the literal-escaping recipe for user text. Reader `like()` patterns using
backslash escapes are not directly interchangeable with these SQL patterns;
construct the backend pattern explicitly and bind it as a value.

## Unicode-insensitive literal search

Use the imported case-fold companion column with `foldGtfsText()` and escape
LIKE metacharacters in literal user input:

```js
import { sql } from 'kysely';
import { foldGtfsText } from 'gtfs/kysely';

const search = 'Straße';
const literal = foldGtfsText(search).replace(/[!%_]/g, '!$&');
const stops = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('stops')
      .select(['stop_id', 'stop_name'])
      .where('source_id', '=', 'metro')
      .where(
        () => sql`
        ${sql.ref('stops._node_gtfs_casefold_stop_name')}
        like ${`%${literal}%`} escape '!'
      `,
      )
      .execute(),
});
```

This requires the companion column populated by node-GTFS import. Folding
preserves accents and uses the same Unicode normalization as imported data.
Native `lower()` and PostgreSQL `ILIKE` do not provide the same folding.
Unfolded SQL LIKE has backend-dependent case behavior; SQLite LIKE is
ASCII-insensitive even on binary columns. Do not use it as a portable
replacement for a case-sensitive reader search.

## Monetary comparisons

Supply integer minor units and constrain the currency. For example, USD 1.24
is `124` minor units, JPY 124 is `124`, and BHD 0.124 is `124`:

```js
const fares = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('fare_attributes')
      .select('fare_id')
      .where('source_id', '=', 'metro')
      .where('currency_type', '=', 'USD')
      .where('price', '>', '123')
      .where('price', '<', '125')
      .execute(),
});
```

These are integer strings, not decimal currency amounts. Convert and validate
application input using the currency's minor-unit exponent, without floating
point rounding. Keep the value within signed 64-bit integer range. SQL does
not check that a currency constraint accompanies an amount comparison.

When selecting large amounts, cast the stored column to text in SQL before
the driver can convert it to a JavaScript number; see the
[exact integer recipe](aggregates.md). A selected SQL price is not a public
repository decimal string. For validated decimal-string equality and formatted
output, keep using the reader:

```js
const fares = await gtfs.schedule.fareAttributes
  .where({ currency_type: 'USD', price: '1.24' })
  .select('fare_id', 'price')
  .all();
```

## Combining service dates with custom SQL

Use `gtfs.query.activeTrips({ serviceDate })` or `gtfs.query.stopTimes(...)`
for ordinary service-day queries. In custom SQL, first select the active
`(source_id, service_id)` pairs: union the matching weekday/calendar interval
with date additions, then exclude date removals. Join on both source and
service ID. For example, this query finds active trips on a known Wednesday:

```js
const trips = await gtfs.database.withKysely({
  callback: (database) => {
    const date = 20260826; // Wednesday; validate dates and derive the weekday for dynamic input.
    const services = database
      .selectFrom('calendar')
      .select(['source_id', 'service_id'])
      .where('start_date', '<=', date)
      .where('end_date', '>=', date)
      .where('wednesday', '=', 1)
      .union(
        database
          .selectFrom('calendar_dates')
          .select(['source_id', 'service_id'])
          .where('date', '=', date)
          .where('exception_type', '=', 1),
      );
    return database
      .selectFrom('trips')
      .innerJoin(services.as('active'), (join) =>
        join
          .onRef('active.source_id', '=', 'trips.source_id')
          .onRef('active.service_id', '=', 'trips.service_id'),
      )
      .where('trips.source_id', '=', 'metro')
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('calendar_dates as removed')
              .select('removed.service_id')
              .whereRef('removed.source_id', '=', 'trips.source_id')
              .whereRef('removed.service_id', '=', 'trips.service_id')
              .where('removed.date', '=', date)
              .where('removed.exception_type', '=', 2),
          ),
        ),
      )
      .select(['trips.source_id', 'trips.trip_id'])
      .execute();
  },
});
```

`UNION` prevents calendar service plus an addition from duplicating a trip.
Use the active-trip selection as a source-correlated EXISTS subquery when
combining activity with OR, NOT, stop-time windows, or other relationships.
A stop time without a matching trip is inactive. Its absence from the active
set is different from an inner join, which would discard it entirely.

## Distinct records

Use SQL `DISTINCT` when every selected field is part of the unique value:

```js
const types = await gtfs.database.withKysely({
  callback: (database) =>
    database
      .selectFrom('routes')
      .where('source_id', '=', 'metro')
      .select('route_type')
      .distinct()
      .orderBy('route_type')
      .execute(),
});
```

To choose a complete representative row for each key, rank matching rows in
partitions and select the first row in each partition:

```js
const trips = await gtfs.database.withKysely({
  callback: (database) => {
    const ranked = database
      .selectFrom('trips')
      .where('source_id', '=', 'metro')
      .select(['source_id', 'route_id', 'trip_id'])
      .select((eb) =>
        eb.fn
          .agg('row_number', [])
          .over((window) =>
            window
              .partitionBy(['source_id', 'route_id'])
              .orderBy('trip_id', 'desc'),
          )
          .as('position'),
      );
    return database
      .selectFrom(ranked.as('ranked'))
      .where('position', '=', 1)
      .select(['source_id', 'route_id', 'trip_id'])
      .orderBy('source_id')
      .orderBy('route_id')
      .offset(20)
      .limit(10)
      .execute();
  },
});
```

This chooses the greatest trip ID per source/route, then pages the chosen
rows. Use enough window-order fields to break ties. The window order chooses
the representative; the outer order controls the returned rows. Filter the
input before ranking when the representative must satisfy those conditions.

Reader `distinct()` and `distinctOn()` are no longer supported. Their former
behavior selected representative rows by named keys. Replacing them with SQL
`DISTINCT` over additional output fields would change their meaning. Use the window recipe for that migration;
PostgreSQL's `DISTINCT ON` is not portable to SQLite and MySQL.
For time keys, partition and sort by the numeric service-day-seconds column.
Include `source_id` in keys when equal IDs from different sources are separate.
Custom SQL returns stored values; apply any needed public-value conversions.

## Next steps

- [Group and summarize filtered records](aggregates.md).
- [Understand stored values and row types](data-model.md#row-representations).
- [Use SQL predicates for map features](geojson.md#advanced-sql-filters).
- [Query current GTFS-Realtime entities](realtime.md#query-current-records).
- [Manage database connections and source scope](databases.md).
