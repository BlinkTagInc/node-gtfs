# Migrate from v4 to v5

[All guides](README.md)

V5 uses explicitly owned instances, asynchronous readers, source-scoped data,
and a new database schema. **Create a fresh database and reimport the original
static GTFS feeds.** Changing the package version against your v4 database is not an upgrade
procedure. This guide assumes an existing v4 SQLite database and compares the
released 4.21.0 API with v5.

## Prepare and switch over

1. Use Node.js 22.18+ (22.x), 24, or 26+.
   Update your application lockfile and test the application with the selected runtime.
2. Preserve the v4 application, lockfile, configuration, original static GTFS feed archives,
   and a consistent SQLite backup. Stop writes before copying SQLite files;
   include any required WAL data or use SQLite's backup facility.
3. Convert configuration and application calls using the sections below. Give
   each static GTFS feed a stable `sourceId`; retain it across later imports and GTFS-Realtime
   refreshes. Set `database.path` to a new file, such as `./transit-v5.sqlite`.
4. Import the original static GTFS feeds into that new SQLite file. Do not copy v4 rows or
   prefixed identifiers into v5 tables. Compare representative routes, service
   dates, arrivals, maps, and exported files before switching the application.
5. Switch scheduled imports, GTFS-Realtime refreshes, and application reads together.
   Retain the old deployment and database until you have verified the new one.
   To roll back, restore that deployment and point it at its v4 database; do not
   open the v5 database with v4. Updates made only to v5 are not copied back.

`schema.ensure()` creates missing tables and rejects incompatible structures;
`schema.validate()` only inspects; `schema.recreate()` deletes and rebuilds enabled
tables. **None migrates v4 stored data.** The `create-if-missing` name found in
earlier v5 drafts is now `ensure`, and was not an in-place migration either.
Recreation affects every source in the enabled tables.

## Replace globals with an instance

Before, in v4:

```js legacy
import { openDb, getRoutes, closeDb } from 'gtfs';

const db = openDb({ sqlitePath: './transit-v4.sqlite' });
try {
  const routes = getRoutes({}, ['route_id', 'route_short_name'], [], { db });
  console.table(routes);
} finally {
  closeDb(db);
}
```

After, in v5:

```ts
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit-v5.sqlite' },
  sources: [{ sourceId: 'metro', schedule: { path: './feed.zip' } }],
});
try {
  await gtfs.import();
  const routes = await gtfs.schedule.routes
    .select('route_id', 'route_short_name')
    .all();
  console.table(routes);
} finally {
  await gtfs.close();
}
```

There is no implicit default database shared by getters. A path opens an owned
SQLite connection, which closes with the instance. A supplied `database.client`
is borrowed and remains open; close it separately when its owner is finished.
For an in-memory import followed by queries, keep the same instance open.
Standalone `importGtfs()` requires an explicit path or client and closes any
connection it opened before returning.

For each old getter, use the [API replacement reference](reference/v4-api.md).
It includes every getter, lifecycle/utility replacement, and row-type rename.

## Convert configuration

Before, in v4:

```json
{
  "sqlitePath": "./transit-v4.sqlite",
  "agencies": [{ "path": "./feed.zip", "prefix": "metro-" }],
  "ignoreDuplicates": true,
  "logLevel": "warning"
}
```

After, in v5:

```json
{
  "database": { "path": "./transit-v5.sqlite" },
  "sources": [
    {
      "sourceId": "metro",
      "schedule": {
        "path": "./feed.zip",
        "import": { "validation": { "onDuplicateKey": "keep-first" } }
      }
    }
  ],
  "reporting": { "level": "warn" }
}
```

The replacement paths below are also used by configuration migration errors.
`[]` means each array entry. Move the values explicitly; old options are not
automatically translated.

<!-- migration-config:start -->

| V4 path                               | V5 path                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `agencies`                            | `sources`                                                              |
| `sqlitePath`                          | `database.path`                                                        |
| `db`                                  | `database.client`                                                      |
| `csvOptions`                          | `sources[].schedule.import.csv`                                        |
| `ignoreDuplicates`                    | `sources[].schedule.import.validation.onDuplicateKey`                  |
| `downloadTimeout`                     | `sources[].schedule.timeoutMs or sources[].realtime.feeds[].timeoutMs` |
| `gtfsRealtimeExpirationSeconds`       | `realtime.retention.currentEntitiesSeconds`                            |
| `exportPath`                          | `export.outputDirectory`                                               |
| `logLevel`                            | `reporting.level`                                                      |
| `ignoreErrors`                        | Removed without replacement                                            |
| `logFunction`                         | `reporting.reporter`                                                   |
| `verbose`                             | `reporting.level`                                                      |
| `agencies[].url`                      | `sources[].schedule.url`                                               |
| `agencies[].path`                     | `sources[].schedule.path`                                              |
| `agencies[].headers`                  | `sources[].schedule.requestHeaders`                                    |
| `agencies[].exclude`                  | `sources[].schedule.excludeFiles`                                      |
| `agencies[].fillEmptyAgencyId`        | `sources[].schedule.defaultAgencyId`                                   |
| `agencies[].agencyId`                 | `sources[].schedule.defaultAgencyId`                                   |
| `agencies[].realtimeAlerts`           | `sources[].realtime.feeds[]`                                           |
| `agencies[].realtimeTripUpdates`      | `sources[].realtime.feeds[]`                                           |
| `agencies[].realtimeVehiclePositions` | `sources[].realtime.feeds[]`                                           |
| `agencies[].prefix`                   | Removed without replacement                                            |

<!-- migration-config:end -->

Adjust values as well as names:

- `ignoreDuplicates: true` becomes `onDuplicateKey: "keep-first"`; `false`
  becomes `"reject"`, which is the default.
- `exclude` used table stems; `excludeFiles` uses exact filenames, including
  `.txt`, `.csv`, or `.geojson`.
- Replace `fillEmptyAgencyId`/`agencyId` with a string `defaultAgencyId` when a
  fallback is needed. It does not override an ID present in `agency.txt`.
- Move GTFS-Realtime feed `headers` to `requestHeaders`. Convert each GTFS-Realtime feed
  into a `feeds` entry with `type: "alerts"`, `"tripUpdates"`, or
  `"vehiclePositions"`; enable `extensions: ["gtfs-realtime"]`.
- Schedule downloads now default to 120,000 ms; GTFS-Realtime feeds default to
  30,000 ms. Timeout/header settings apply to URL inputs, not local paths.
- `csvOptions` becomes the supported [CSV options](reference/configuration.md#csv-options)
  subset: `skip_empty_lines` becomes `skipEmptyLines`, and `relax_quotes` becomes
  `relaxQuotes`. Do not copy arbitrary parser options into the new object.
- Replace `warning` with `warn`. `verbose: false` can become `level: "warn"`;
  use `silent` to suppress all reporting. A library call without a reporter is
  silent by default; the CLI installs a console reporter.
- Remove `includeImportReport`; successful import/refresh calls always return a
  `GtfsImportResult`. Inspect `success`, `errors`, `sources`, and `validation`.
- `ignoreErrors` has no direct equivalent. Choose a validation mode and, for
  Schedule imports, `onSourceError: "continue"` deliberately; inspect failures
  in the result. Parsing and database failures are not made harmless by this policy.

See [configuration](reference/configuration.md) for accepted values and defaults. To import
optional formats, enable their extensions explicitly, or use `extensions: "auto"`
with standalone Schedule import. Instances, export, and GTFS-Realtime need explicit
extension arrays. The v4 TODS files use `"tods-v1"`; current `"tods"` is a different
format and must use a separate database. For NOPTIS data, use the
[separate companion-data workflow](#noptis-companion-data) below.

## NOPTIS companion data

V5 removes support for `trips_dated_vehicle_journey.txt`,
`getTripsDatedVehicleJourneys()` and `TripsDatedVehicleJourney`. There is no
replacement repository or `noptis` extension. `extensions: "auto"` does not
import this file, and node-GTFS does not export it.

If your application uses these mappings:

1. Retain the companion CSV alongside the matching static GTFS feed. Parse and
   validate it in your application, independently of the node-GTFS import.
2. Store its rows in an application-owned file or table. Keep `trip_id`,
   `operating_day_date` and `dated_vehicle_journey_gid` as strings, retain
   `journey_number`, and add the same `source_id` used for the Schedule import.
   Preserve all mapping rows; do not use the journey GID alone as a unique key.
3. Replace old getter calls with lookups in that store, filtered by source,
   trip and operating date. Match Schedule trips using both `source_id` and
   the original `trip_id`; remove old prefix assumptions. Define the mapping's
   TypeScript interface in your application.
4. Refresh the mappings with their matching static GTFS feed and coordinate the
   application cutover so readers see matching versions. Source replacement,
   schema operations and export do not maintain application-owned mapping data;
   include the companion file separately when distributing your export.

## Keep source identities and replacement behavior explicit

V5 preserves original GTFS IDs. Two static GTFS feeds can both contain `route_id: "1"`;
their `source_id` distinguishes them. Remove application assumptions that IDs
start with the old `prefix`. `sourceId` identifies an imported static GTFS feed, not an agency
within it. Several sources require unique explicit IDs; a lone omitted ID defaults
to `"default"`.

The default Schedule policy replaces one source transactionally. A failed source
restores its prior data; earlier successful sources in the same call remain
committed. Replacement clears that source's GTFS-Realtime state/history and old rows
in enabled files that are absent or excluded from the new input. Other sources
remain. Use `onExistingData: "reject"` if replacement should be refused.

Queries respect the instance's configured source scope. Custom SQL must include
`source_id` in its filters and joins; GTFS-Realtime joins also need `realtime_feed_id`
and the relevant entity/child keys.

## Convert queries and returned values

Replace positional `(query, fields, orderBy, { db })` arguments with chained
readers. Equality filters use field names and scalar values; `null` matches a
missing value, while explicit `undefined` is rejected. Arrays, operators,
relationships and boolean groups belong in typed SQL.

```ts
import type { Gtfs } from 'gtfs';

export async function readRoutes(gtfs: Gtfs) {
  return gtfs.schedule.routes
    .where({ agency_id: 'metro' })
    .select('route_id', 'route_short_name')
    .orderBy([{ field: 'route_id', direction: 'asc' }])
    .limit(20)
    .all();
}
```

Sort directions are lowercase `asc`/`desc`. Omit `select()` for default fields;
an empty selection is invalid. Readers are immutable: keep the returned reader
when adding a filter or changing selection/order.

| Need                    | V5 call                                                   |
| ----------------------- | --------------------------------------------------------- |
| All matching rows       | `await reader.all()` returns an array                     |
| One row, or no match    | `await reader.first()` returns a row or `null`            |
| One required row        | `await reader.firstOrThrow()` rejects when no row matches |
| Count                   | `await reader.count()` returns a number                   |
| Incremental consumption | `for await (const row of reader.stream()) { ... }`        |

`all()` is a Promise; `stream()` is a single-use async iterator. Do not await a
stream expecting an array. Close an unfinished iterator with `return()`; breaking
a `for await` loop does this automatically. Earlier v5 drafts' dual result objects,
callback filters, aggregate methods, and callback ordering are not the final API.

| V4 query feature                                    | V5 replacement                                                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Related `route_id` on stops                         | `gtfs.query.stopsForRoute({ routeId })`                                                                                                                   |
| Service `date` on trips                             | `gtfs.query.activeTrips({ serviceDate })` or trips `.where({ serviceDate })`                                                                              |
| Stop-time date/time window                          | `gtfs.query.stopTimes({ serviceDate, stopId, window: { field, start, end } })`                                                                            |
| Bounding box around a point                         | Calculate bounds, then use `withinBounds: { south, west, north, east }`; distance ordering is not automatic                                               |
| Membership, comparisons, joins, summaries           | `gtfs.database.withKysely({ callback })`; see [SQL filters](sql-queries.md) and [aggregates](aggregates.md)                                               |
| `getServiceIdsByDate(date)` without requiring trips | Combine calendar weekdays and added exceptions, excluding removed exceptions; see the [service-ID example](reference/v4-api.md#service-ids-without-trips) |

Default rows include `source_id`. Select generated fields such as
`arrival_service_day_seconds` explicitly; they replace Schedule `*_timestamp`
fields and measure seconds from the service-day start, not Unix time.
Times beyond midnight remain strings such as `"25:10:00"`. Monetary values in
repository rows are exact decimal strings; direct SQL sees integer minor units.
IDs remain strings, dates are `YYYYMMDD` numbers, and JSON fields remain JSON text.
See [row representations](data-model.md#row-representations) before reusing v4 result types.

## Operations, schema checks, and concurrency

The database, enabled extensions and source scope belong to the instance. Per-call
import/refresh inputs replace configured inputs for that call and need explicit
source IDs within its scope. They do not mutate instance defaults. Per-call
validation/retention merge the specified policy fields; reporting replaces the
reporter/level for that call. See [operation options](reference/configuration.md#instance-operation-options).

```ts
import type { Gtfs } from 'gtfs';

export async function importDownload(gtfs: Gtfs, signal: AbortSignal) {
  return gtfs.import({
    signal,
    sources: [{ sourceId: 'metro', schedule: { path: './latest.zip' } }],
    validation: { mode: 'strict' },
  });
}
```

Import, export and GTFS-Realtime refresh accept a per-call `AbortSignal`. Cancellation
rejects with `GTFS_OPERATION_CANCELLED`; it restores the current uncommitted source
or snapshot, but does not undo earlier committed sources/GTFS-Realtime feeds. Completed
export publication remains successful. See [cancellation](cancellation.md).

Queries inspect required tables when executed; streams inspect when iteration
starts. A schema validation result is a point-in-time observation. External schema
changes are checked again on later reads, but applications must coordinate DDL
with active work.

SQLite operations run serially. Finish active streams before writes,
export or custom SQL. `withKysely()` is exclusive within the instance, and all SQL
work must finish inside its callback. Closing rejects new operations, releases
streams and drains accepted work; it does not cancel in-flight SQL. See
[connection lifetime](databases.md#connection-ownership-and-closing).

## Validation, reporting, and durability

Static GTFS feed validation is **off by default**. `strict` rejects error-level validation
notices; warnings alone do not reject. `permissive` reports issues and skips rows
that cannot be stored. Parsing, normalization, archive limits and database
constraints still apply when validation is off. Unknown columns default to
preservation in `_unknown_fields`, with export restoring those columns.

Replace `(message, level)` log callbacks with a reporter receiving an event:

```ts
import {
  Gtfs,
  createConsoleReporter,
  formatGtfsError,
  isGtfsError,
} from 'gtfs';

export async function importWithReporting() {
  const gtfs = new Gtfs({
    database: { path: './transit-v5.sqlite' },
    sources: [{ sourceId: 'metro', schedule: { path: './feed.zip' } }],
    reporting: { reporter: createConsoleReporter({ animateProgress: false }) },
  });
  try {
    const result = await gtfs.import();
    console.log(result.success, result.validation.countsByCode);
  } catch (error) {
    if (isGtfsError(error) && error.category === 'validation') {
      console.error(formatGtfsError(error, { audience: 'user' }));
    }
    throw error;
  } finally {
    await gtfs.close();
  }
}
```

Replace `GtfsWarning`/`GtfsWarningCode` with `GtfsValidationNotice`/
`GtfsValidationNoticeCode`; use `result.validation.samples` and
`result.validation.countsByCode`. Samples are capped at 100; a reporter can
receive every notice. Codes, severity and structured positions are better for
application decisions than message text. `isGtfsValidationError(error)` becomes
`isGtfsError(error) && error.category === 'validation'`. Formatter `verbosity`
becomes `audience`. See [diagnostics](reporting.md#read-diagnostic-details).

Owned SQLite files default to WAL/FULL durability rather than v4's unsafe import
pragmas. Do not copy those pragmas as a migration step. `unsafe-bulk` is opt-in,
limited to an empty owned database, and appropriate only for disposable data.
Borrowed clients keep their caller-managed settings.

## GTFS-Realtime and export

`updateGtfsRealtime(config)` becomes `refreshGtfsRealtime(config)` or
`gtfs.realtime.refresh()`. Refresh is one fetch cycle, not a polling service.
Use stable source/GTFS-Realtime feed IDs; current rows and retained history are separate.
Full snapshots replace that GTFS-Realtime feed's current records, while differential snapshots
apply updates/deletions. Identical retained snapshots are not reapplied.

Current GTFS-Realtime rows use `entity_id` and `realtime_feed_id`. Library-added
creation/expiry fields and stop-update timestamps use `*_unix_seconds`;
protobuf `timestamp` fields retain their names. Alerts and selectors are queried separately instead of returning
the v4 composed `informed_entities` property. See the
[field/type reference](reference/v4-api.md#gtfs-realtime-fields-and-types) and
[GTFS-Realtime guide](realtime.md).

Current retention defaults to 30 seconds; history defaults to 86,400 seconds.
**Zero means immediately eligible for cleanup.** Only snapshot history accepts
`null` for indefinite retention. Expired rows remain queryable until
`gtfs.realtime.cleanup()` runs; schedule cleanup as well as refresh.

Export returns `GtfsExportResult` with the source ID, output directory,
written file counts and duration. With multiple
sources, select one `sourceId`. Existing output is refused unless `overwrite`
is enabled, which replaces the entire dedicated directory. Check the result
before consuming files; see [export safety](export.md#choose-a-safe-output-directory).

## Update CLI scripts

| V4                    | V5                      |
| --------------------- | ----------------------- |
| `gtfs-import`         | `gtfs import`           |
| `gtfs-export`         | `gtfs export`           |
| `gtfsrealtime-update` | `gtfs realtime refresh` |
| `--configPath`        | `--config`              |
| `--sqlitePath`        | `--database`            |
| `--gtfsPath`          | `--input`               |
| `--gtfsUrl`           | `--url`                 |
| `--logLevel`          | `--log-level`           |

Use `gtfs <command> --help` for available flags. Replace
`config-sample-rtupdates.json` with `config-sample-realtime.json`. Update cron jobs
and deployment scripts as well as application imports; the old executable names
are not installed by v5.

## Next steps

- [Look up each v4 API and row-type replacement](reference/v4-api.md).
- [Check configuration values and defaults](reference/configuration.md).
- [Build queries with the v5 API](queries.md).
- [Update command-line automation](cli.md).
- [Investigate migration and runtime errors](troubleshooting.md).
