# Schema manifest

node-GTFS exports its table definitions and TypeScript database types from
`gtfs/schema`. The same exports are also available from the main `gtfs` package.

Use the schema API to:

- inspect the files, fields, and extensions supported by node-GTFS;
- build forms, documentation, or validation tools;
- find relationships between GTFS tables;
- type Kysely queries and application data.

## Inspecting tables

```js
import { gtfsManifest, gtfsJoins, tables } from 'gtfs/schema';

console.log(gtfsManifest.routes.file); // routes.txt
console.log(gtfsManifest.routes.primaryKey); // ['route_id']
console.log(gtfsManifest.routes.fields.route_type.kind); // integer
console.log(gtfsJoins.routes);

// The original table definition is also available directly.
console.log(tables.routes);
```

`gtfsManifest` is keyed by database table name. Its entries are
JSON-serializable and have a consistent shape:

| Property      | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `file`        | Source filename, or `null` for non-file-backed realtime tables |
| `table`       | Database name for a non-file-backed table                      |
| `namespace`   | Specification or extension that defines the table              |
| `presence`    | Whether the source file is required, optional, or conditional  |
| `primaryKey`  | Fields used to identify a row                                  |
| `fields`      | Field definitions keyed by column name                         |
| `constraints` | Cross-field semantic rules                                     |
| `storage`     | Declared database indexes                                      |

`tables` contains the individual definitions before manifest defaults are
filled in. Definitions can also be imported by name:

```js
import { routes, stopTimes } from 'gtfs/schema';
```

The supported namespaces are exported as `gtfsNamespaces`:

```text
gtfs-schedule, gtfs-realtime, gtfs-plus, gtfs-ride, gtfs-to-html,
noptis, tods, tides
```

## Field metadata

Each field has a `kind` and may include additional metadata:

| Property                    | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `kind`                      | `id`, `text`, `integer`, `real`, `date`, `time`, `json`, or `enumeration` |
| `presence`                  | Whether each record requires a value                                      |
| `references`                | Possible target fields as `{ file, field }` objects                       |
| `applyFeedPrefix`           | Whether feed prefixes are applied when merging feeds                      |
| `defaultValue`              | Value used when the source value is missing or empty                      |
| `caseInsensitiveComparison` | Requests case-insensitive database comparisons                            |
| `minimum`, `maximum`        | Inclusive numeric bounds                                                  |
| `values`                    | Known values for an enumeration                                           |
| `closed`                    | Restricts the inferred type to known values when `true`                   |
| `sourcePath`                | Source property used for a GTFS-Realtime field                            |

GTFS identifiers use `kind: 'id'` and are stored as text. A numeric-looking ID
therefore remains an identifier rather than a number.

Enumerations are open unless `closed: true` is declared. Known values appear in
TypeScript autocomplete, but newer values can still be imported. This is
especially important for GTFS-Realtime, where specifications can add enum
members.

References describe relationships but do not create database foreign keys.
Multiple references on one field are alternative targets.
`gtfsJoins` contains the references that correspond to queryable SQL columns.
References into structured files, such as feature IDs in `locations.geojson`,
remain in the manifest but are not included in `gtfsJoins`.

SQLite implements `caseInsensitiveComparison` with `COLLATE NOCASE`.
PostgreSQL and MySQL use their configured database or column collation. See
[Database portability](database-portability.md) for storage details.

## TypeScript types

Named row types such as `Agency`, `Route`, `StopTime`, and `VehiclePosition`
are inferred from the table definitions.

Generic types are available when working directly with a definition:

```ts
import {
  routes,
  type GtfsDatabase,
  type GtfsInsert,
  type GtfsQuery,
  type GtfsRow,
  type GtfsStoredRow,
} from 'gtfs/schema';

type RouteSourceRow = GtfsRow<typeof routes>;
type RouteDatabaseRow = GtfsStoredRow<typeof routes>;
type RouteInsert = GtfsInsert<typeof routes>;
type RouteQuery = GtfsQuery<typeof routes>;
```

- `GtfsRow` contains normalized source fields.
- `GtfsStoredRow` also contains node-GTFS generated time columns.
- `GtfsInsert` marks only required fields as required.
- `GtfsQuery` supports scalar and array filters for stored fields.
- `GtfsDatabase` maps every table name to its stored row type and can be used
  as the database type for Kysely.

## Validation scope

The GTFS Schedule definitions were reviewed against the specification revision
exported as `gtfsScheduleReferenceRevision`.

The manifest describes required, recommended, and conditional data, but
node-GTFS is not a complete GTFS validator. Some conditional, cross-row, and
cross-file rules are metadata only. References are advisory and are not
enforced as database foreign keys.

GTFS-Realtime schemas currently cover `TripUpdate`, `VehiclePosition`, and
`Alert`. Repeated values such as translations and carriage details are stored
as JSON. Feed headers, differential-feed deletions, `Shape`, `Stop`, and
`TripModifications` are not currently persisted.

Realtime `sourcePath` values are checked against the installed official
`gtfs-realtime-bindings` package during testing.

For the full GTFS Schedule specification, see the
[official reference](https://gtfs.org/documentation/schedule/reference/).
