# Filters

[All guides](README.md) · [Query basics](queries.md)

## Equality and missing values

Reader `where()` and `first(filter)` accept field equality and GTFS semantic
filters. An object matches all its fields:

```js
const routes = await gtfs.schedule.routes
  .where({ agency_id: 'metro', route_type: 3 })
  .all();
```

Use `null` to match a missing value. Omit a property to leave it unfiltered.
Explicit `undefined` is an error. Values must match the field's type: identifiers
are strings, numeric fields are numbers, and money values are decimal strings.

Chained filters must all match. A later filter does not replace an earlier one.
For optional input, add a condition only when it is available:

```js
let query = gtfs.schedule.routes.where({ route_type: 3 });
const agencyId = process.env.AGENCY_ID;
if (agencyId !== undefined) {
  query = query.where({ agency_id: agencyId });
}
const routes = await query.all();
```

Reader callbacks, operator objects, membership arrays, and named relationship
filters are not supported. Use [typed SQL](sql-queries.md) for ranges, OR/NOT,
text searches, field comparisons, and custom joins. Execute SQL inside
`gtfs.database.withKysely()` and add source filters explicitly.

## Dates and service-day times

`serviceDate` is available on `trips` and `stopTimes`. Pass a real calendar
date as a `YYYYMMDD` number. It combines weekday service and date bounds from
`calendar.txt` with additions/removals in `calendar_dates.txt`.

```js
const trips = await gtfs.schedule.trips
  .where({ route_id: 'red', serviceDate: 20260914 })
  .all();
```

For stop times on a service date within a time window:

```js
const arrivals = await gtfs.query
  .stopTimes({
    serviceDate: 20260914,
    stopId: 'central',
    window: { field: 'arrival_time', start: '15:00:00', end: '16:00:00' },
  })
  .orderBy([{ field: 'arrival_time', direction: 'asc' }])
  .select('trip_id', 'stop_id', 'arrival_time', 'departure_time')
  .all();
```

The window includes its start and excludes its end. Choose `departure_time`
when departure is what matters. To include an upper boundary, use an explicit
SQL `<=` comparison on the numeric service-day-second column.

GTFS times belong to a service day, not a Unix clock. `25:15:00` means 1:15 a.m.
after the beginning of that service day. Reader time equality and sorting use
numeric service-day seconds, so `9:00:00` and `09:00:00` compare equally and
post-midnight times sort correctly. Invalid dates and malformed times are errors.

## Filter by related records

Use a domain query for stops served by a route:

```js
const stops = await gtfs.query
  .stopsForRoute({ routeId: 'red', serviceDate: 20260914 })
  .all();
```

For other relationships, use [source-aware SQL joins and EXISTS](sql-queries.md#joining-related-records).
SQL queries operate on stored values; they do not automatically inherit instance
source filters or convert results to public row values.

## Geographic bounds

```js
const stops = await gtfs.schedule.stops
  .where({
    withinBounds: { south: 37.7, west: -122.5, north: 37.9, east: -122.3 },
  })
  .all();
```

All four bounds are required, in degrees. Boundaries are inclusive. Null
coordinates do not match. `south` must not exceed `north`; a `west` value
greater than `east` represents a box crossing the antimeridian.

This is a rectangular filter, not a radius search or polygon intersection.

## GTFS-Realtime active periods

```js
const alerts = await gtfs.realtime.alerts
  .where({ communicationActiveAt: 1700000000 })
  .all();
```

`communicationActiveAt` and `impactActiveAt` accept non-negative integer Unix
seconds (a safe number or signed 64-bit bigint). Period starts are inclusive;
ends are exclusive. See [GTFS-Realtime](realtime.md) for active-period semantics.

## Amounts

Money equality requires a currency in the same object or another chained filter:

```js
const fares = await gtfs.schedule.fareProducts
  .where({ currency: 'USD', amount: '2.50' })
  .all();
```

Use decimal strings, not floating-point amounts. For monetary ranges and
aggregates, use [SQL minor-unit comparisons](sql-queries.md#monetary-comparisons).

## Next steps

- [SQL filters and text searches](sql-queries.md).
- [Check source and GTFS-Realtime feed keys for joins](sql-queries.md#joining-related-records).
- [Summarize filtered records](aggregates.md).
- [Apply filters to map features](geojson.md#filter-by-service-or-route).
- [Look up available fields and query filters](data-model.md#files-and-repositories).
