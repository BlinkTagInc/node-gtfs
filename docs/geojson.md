# GeoJSON for maps

[All guides](README.md)

GeoJSON describes map features using coordinates and properties. node-GTFS
returns a `FeatureCollection` you can save to a file or pass to mapping software.
It does not render the map itself.

## Choose the feature you need

| Method                  | One feature per…                          | Geometry          |
| ----------------------- | ----------------------------------------- | ----------------- |
| `gtfs.geojson.stops()`  | Stop with coordinates, within each source | `Point`           |
| `gtfs.geojson.shapes()` | Shape ID, within each source              | `LineString`      |
| `gtfs.geojson.routes()` | Route, within each source                 | `MultiLineString` |

Each returns one collection, not one output file per stop, shape, or route.

```js
const stops = await gtfs.geojson.stops();
const shapes = await gtfs.geojson.shapes({ where: { shape_id: 'outbound' } });
const routes = await gtfs.geojson.routes({ where: { route_id: 'red' } });
```

## Filter by service or route

Use `routeId` and an optional numeric `YYYYMMDD` `serviceDate` to select features
served by a route on a date. All three methods support both selectors.
`where` accepts field equality and GTFS semantic objects; fields belong to
`stops`, `shapes`, or `routes`, respectively. These filters combine with AND.

```js
const stops = await gtfs.geojson.stops({
  routeId: 'red',
  serviceDate: 20260922,
});
```

This chooses stops served by the route. A chosen stop’s `routes` property
still describes all its serving routes, not only the route used to match it.
Service dates apply weekday schedules and `calendar_dates` additions/removals.
When both selectors are supplied, the same trip must match both. IDs are
matched within each source. A date selects complete route/shape geometry;
it does not trim geometry or metadata to the trips active that day.

```js
const stopsInView = await gtfs.geojson.stops({
  where: {
    withinBounds: { south: 37.7, west: -122.5, north: 37.9, east: -122.3 },
  },
});
```

Shape filters select matching shape IDs and then return their complete
geometry. Filtering shape points does not clip a line. To select complete
route geometry, use `geojson.routes()` with route filters.

## Use parent stations instead of platforms

Set `useParentStation: true` to show one marker for a station instead of
separate markers for its platforms:

```js
const stops = await gtfs.geojson.stops({
  useParentStation: true,
  routeId: 'red',
  serviceDate: 20260922,
});
```

- Selected child locations use their parent station's `stop_id`, name,
  coordinates, and other stop properties, including available GTFS+ attributes.
- Each station appears once within its source. Standalone stops remain.
- A station's `routes` includes all routes serving its platforms, even if
  the filter matched only one platform or route.
- Entrances and internal nodes resolve directly to their station. Boarding
  areas resolve through their platform to its station.
- Child locations are excluded from the result. If their parent is missing,
  has an invalid location type, or has unusable coordinates, those children
  are omitted. Locations without usable coordinates are also omitted.

All filters apply **before** parent replacement. For example, a platform within
geographic bounds can produce a station marker outside those bounds. The
returned properties belong to the station; platform-specific values are not
copied onto it.

The option defaults to `false`, which excludes parent stations
(`location_type: 1`) and returns selected child and standalone locations without
replacement or inherited route metadata. It is available only on `stops()`.

Use `where` to narrow the result further:

```js
const stationsOnly = await gtfs.geojson.stops({
  useParentStation: true,
  where: { location_type: 1 },
});

const stopsAndPlatforms = await gtfs.geojson.stops({
  sqlWhere: (eb) =>
    eb.or([
      eb('stops.location_type', '=', 0),
      eb('stops.location_type', 'is', null),
    ]),
});
```

An empty `location_type` means a stop/platform in GTFS. Filtering to stations
alone excludes standalone bus stops. A station-only request requires
`useParentStation: true` and includes its platforms' serving-route metadata.

## Advanced SQL filters

Replace `where: (fields) => ...` callbacks with the selectors above or a Kysely
`sqlWhere` callback. The callback receives an expression builder for the root
table and must return a synchronous boolean SQL expression:

```js
const routes = await gtfs.geojson.routes({
  sqlWhere: (eb) =>
    eb.exists(
      eb
        .selectFrom('trips')
        .select('trip_id')
        .whereRef('trips.source_id', '=', 'routes.source_id')
        .whereRef('trips.route_id', '=', 'routes.route_id')
        .where('trips.shape_id', '=', 'outbound'),
    ),
});
```

`sqlWhere` is combined with the other filters and the instance's source scope.
Subqueries must explicitly match source IDs (and GTFS-Realtime feed IDs for GTFS-Realtime tables).
Use trusted application SQL; bind user values with Kysely. The callback runs
once per request and returns an expression, not a query builder or connection.
Queries and geometry loading complete inside the instance's operation lifetime.

SQL predicates use stored values: compare extended GTFS times using the derived
service-day-second columns, and monetary values using integer minor units.
Extra tables and columns referenced by SQL are not automatically checked;
missing references produce database errors. SQL does not change the selected
feature properties or the complete-geometry behavior.

For Unicode-insensitive searches, `foldGtfsText` from `gtfs/kysely` uses the same
Unicode 17 folding and NFC normalization as imported text. Use it with the
corresponding stored case-fold column and escape wildcard characters when the
search text should be literal:

```js
import { sql } from 'kysely';
import { foldGtfsText } from 'gtfs/kysely';

const search = 'Straße';
const literal = foldGtfsText(search).replace(/[!%_]/g, '!$&');
const stops = await gtfs.geojson.stops({
  sqlWhere: () => sql`
    ${sql.ref('stops._node_gtfs_casefold_stop_name')}
    like ${`%${literal}%`} escape '!'
  `,
});
```

This requires the case-fold companion column populated by node-GTFS import.
Native `lower()` or `ILIKE` does not provide the same Unicode folding.

## Save a file

```js
import { writeFile } from 'node:fs/promises';

const collection = await gtfs.geojson.routes({ where: { route_id: 'red' } });
await writeFile('./route.geojson', JSON.stringify(collection));
```

## Properties and geometry

- Coordinates use `[longitude, latitude]` order.
- Stop properties include GTFS stop fields and a `routes` array; coordinates
  are in the geometry, not repeated as `stop_lat`/`stop_lon` properties.
- Shape properties include `source_id`, `shape_id`, and a `routes` array.
- Route features include route properties. Colors include a leading `#`.
- Missing optional properties are omitted rather than set to `null`.
- `agency_name` is included where an agency can be identified unambiguously.
- When GTFS+ is enabled, available stop/route attributes are included.

Shape points are ordered by `shape_pt_sequence`. Stops without coordinates
and shapes without a usable line are omitted. Route geometry combines its
trip shapes and removes repeated segments, including reverse duplicates,
without connecting unrelated line sections. A route without usable shapes
has no route feature.

Records with identical IDs in different sources remain distinct. Use
`source_id` together with the GTFS ID in your map application.

All collections are built in memory. Filter large static GTFS feeds to the area or routes
you need. The methods do not accept pagination or field-selection options.

TypeScript users can use `GtfsStopGeoJSONProperties`,
`GtfsShapeGeoJSONProperties`, and `GtfsRouteGeoJSONProperties` from `gtfs`.

## Flex service areas: locations.geojson

`locations.geojson` is an input file describing Flex service areas; it is
separate from the three mapping methods above. Its features are available
through `gtfs.schedule.locations`:

```js
const locations = await gtfs.schedule.locations
  .select('source_id', 'id', 'stop_name', 'geometry')
  .all();

const features = locations.map((location) => ({
  type: 'Feature',
  id: location.id,
  properties: {
    source_id: location.source_id,
    stop_name: location.stop_name,
  },
  geometry: JSON.parse(location.geometry),
}));
```

Each feature’s `id` is referenced by `stop_times.location_id` within the same
source. Import accepts polygon and multipolygon areas. [GTFS export](export.md)
reconstructs the file as a FeatureCollection.

## Next steps

- [Filter stops within a geographic area](query-filters.md#geographic-bounds).
- [Find service, trips, and stops for a route](queries.md#query-service-routes-and-stops).
- [Look up available fields](data-model.md#look-up-fields).
- [Export GTFS files](export.md).
- [Read live vehicle positions for a map](realtime.md#query-current-records).
