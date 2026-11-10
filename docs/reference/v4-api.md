# V4 API replacements

[Migration guide](../migrating-to-v5.md) · [All guides](../README.md)

## Getters

Each row shows the unfiltered replacement for a released v4 getter. Add
`where`, `select` and `orderBy` before the terminal as described in the
[migration guide](../migrating-to-v5.md#convert-queries-and-returned-values).
`gtfs` is an open instance with the relevant extension enabled. These are
repository replacements; composed alert results and related filters require
the adjustments below.

| V4                                  | V5                                                     |
| ----------------------------------- | ------------------------------------------------------ |
| `getAgencies()`                     | `await gtfs.schedule.agency.all()`                     |
| `getAreas()`                        | `await gtfs.schedule.areas.all()`                      |
| `getAttributions()`                 | `await gtfs.schedule.attributions.all()`               |
| `getBookingRules()`                 | `await gtfs.schedule.bookingRules.all()`               |
| `getCalendars()`                    | `await gtfs.schedule.calendar.all()`                   |
| `getCalendarDates()`                | `await gtfs.schedule.calendarDates.all()`              |
| `getFareAttributes()`               | `await gtfs.schedule.fareAttributes.all()`             |
| `getFareLegJoinRules()`             | `await gtfs.schedule.fareLegJoinRules.all()`           |
| `getFareLegRules()`                 | `await gtfs.schedule.fareLegRules.all()`               |
| `getFareMedia()`                    | `await gtfs.schedule.fareMedia.all()`                  |
| `getFareProducts()`                 | `await gtfs.schedule.fareProducts.all()`               |
| `getFareRules()`                    | `await gtfs.schedule.fareRules.all()`                  |
| `getFareTransferRules()`            | `await gtfs.schedule.fareTransferRules.all()`          |
| `getFeedInfo()`                     | `await gtfs.schedule.feedInfo.all()`                   |
| `getFrequencies()`                  | `await gtfs.schedule.frequencies.all()`                |
| `getLevels()`                       | `await gtfs.schedule.levels.all()`                     |
| `getLocationGroupStops()`           | `await gtfs.schedule.locationGroupStops.all()`         |
| `getLocationGroups()`               | `await gtfs.schedule.locationGroups.all()`             |
| `getLocations()`                    | `await gtfs.schedule.locations.all()`                  |
| `getNetworks()`                     | `await gtfs.schedule.networks.all()`                   |
| `getPathways()`                     | `await gtfs.schedule.pathways.all()`                   |
| `getRiderCategories()`              | `await gtfs.schedule.riderCategories.all()`            |
| `getRouteNetworks()`                | `await gtfs.schedule.routeNetworks.all()`              |
| `getRoutes()`                       | `await gtfs.schedule.routes.all()`                     |
| `getShapes()`                       | `await gtfs.schedule.shapes.all()`                     |
| `getStopAreas()`                    | `await gtfs.schedule.stopAreas.all()`                  |
| `getStoptimes()`                    | `await gtfs.schedule.stopTimes.all()`                  |
| `getStops()`                        | `await gtfs.schedule.stops.all()`                      |
| `getTimeframes()`                   | `await gtfs.schedule.timeframes.all()`                 |
| `getTransfers()`                    | `await gtfs.schedule.transfers.all()`                  |
| `getTranslations()`                 | `await gtfs.schedule.translations.all()`               |
| `getTrips()`                        | `await gtfs.schedule.trips.all()`                      |
| `getServiceAlertInformedEntities()` | `await gtfs.realtime.alertEntitySelectors.all()`       |
| `getServiceAlerts()`                | `await gtfs.realtime.alerts.all()`                     |
| `getStopTimeUpdates()`              | `await gtfs.realtime.tripUpdateStopTimeUpdates.all()`  |
| `getTripUpdates()`                  | `await gtfs.realtime.tripUpdates.all()`                |
| `getVehiclePositions()`             | `await gtfs.realtime.vehiclePositions.all()`           |
| `getCalendarAttributes()`           | `await gtfs.gtfsPlus.calendarAttributes.all()`         |
| `getDirections()`                   | `await gtfs.gtfsPlus.directions.all()`                 |
| `getRouteAttributes()`              | `await gtfs.gtfsPlus.routeAttributes.all()`            |
| `getStopAttributes()`               | `await gtfs.gtfsPlus.stopAttributes.all()`             |
| `getBoardAlights()`                 | `await gtfs.gtfsRide.boardAlight.all()`                |
| `getRideFeedInfo()`                 | `await gtfs.gtfsRide.rideFeedInfo.all()`               |
| `getRiderTrips()`                   | `await gtfs.gtfsRide.riderTrip.all()`                  |
| `getRidership()`                    | `await gtfs.gtfsRide.ridership.all()`                  |
| `getTripCapacities()`               | `await gtfs.gtfsRide.tripCapacity.all()`               |
| `getTimetableNotes()`               | `await gtfs.gtfsToHtml.timetableNotes.all()`           |
| `getTimetableNotesReferences()`     | `await gtfs.gtfsToHtml.timetableNotesReferences.all()` |
| `getTimetablePages()`               | `await gtfs.gtfsToHtml.timetablePages.all()`           |
| `getTimetableStopOrders()`          | `await gtfs.gtfsToHtml.timetableStopOrder.all()`       |
| `getTimetables()`                   | `await gtfs.gtfsToHtml.timetables.all()`               |
| `getDeadheadTimes()`                | `await gtfs.todsV1.deadheadTimes.all()`                |
| `getDeadheads()`                    | `await gtfs.todsV1.deadheads.all()`                    |
| `getOpsLocations()`                 | `await gtfs.todsV1.opsLocations.all()`                 |
| `getRunEvents()`                    | `await gtfs.todsV1.runEvent.all()`                     |
| `getRunsPieces()`                   | `await gtfs.todsV1.runsPieces.all()`                   |
| `getDevices()`                      | `await gtfs.tides.devices.all()`                       |
| `getFareTransactions()`             | `await gtfs.tides.fareTransactions.all()`              |
| `getOperators()`                    | `await gtfs.tides.operators.all()`                     |
| `getPassengerEvents()`              | `await gtfs.tides.passengerEvents.all()`               |
| `getStationActivities()`            | `await gtfs.tides.stationActivities.all()`             |
| `getStopVisits()`                   | `await gtfs.tides.stopVisits.all()`                    |
| `getTrainCars()`                    | `await gtfs.tides.trainCars.all()`                     |
| `getTripsPerformed()`               | `await gtfs.tides.tripsPerformed.all()`                |
| `getVehicleLocations()`             | `await gtfs.tides.vehicleLocations.all()`              |
| `getVehicleTrainCars()`             | `await gtfs.tides.vehicleTrainCars.all()`              |
| `getVehicles()`                     | `await gtfs.tides.vehicles.all()`                      |

`getTripsDatedVehicleJourneys()` was removed with NOPTIS support. Use
[application-owned companion mappings](../migrating-to-v5.md#noptis-companion-data)
for source, trip and operating-date lookups.

## Lifecycle, operations, and utilities

| V4 API                                        | V5 action                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openDb({ sqlitePath })`                      | `new Gtfs({ database: { path } })`; no global connection registry                                                                                       |
| `openDb({ db })`                              | `new Gtfs({ database: { client: db } })`; the client remains caller-owned                                                                               |
| `closeDb(db)`                                 | `await gtfs.close()`; close a borrowed client separately                                                                                                |
| `deleteDb(db)`                                | Close all users of the database, then delete the known disposable file yourself; `schema.recreate()` rebuilds enabled tables but does not delete a file |
| `importGtfs(config)`                          | `await importGtfs(config)` with nested v5 configuration; always returns `GtfsImportResult`                                                              |
| `importGtfsToKysely(config, { db, dialect })` | `await importGtfs({ ...config, database: { client: db } })`; client adapter supplies the dialect                                                        |
| `updateGtfsRealtime(config)`                  | `await refreshGtfsRealtime(config)` or `await gtfs.realtime.refresh()`                                                                                  |
| `exportGtfs(config)`                          | `await exportGtfs(config)` or `await gtfs.export({ sourceId, outputDirectory })`; returns `GtfsExportResult`                                            |
| `advancedQuery(table, options)`               | Execute typed SQL inside `gtfs.database.withKysely({ callback })`                                                                                       |
| `getStopsAsGeoJSON(query)`                    | `await gtfs.geojson.stops({ where })`; related route filters use `routeId`                                                                              |
| `getShapesAsGeoJSON(query)`                   | `await gtfs.geojson.routes({ where })` for combined route geometry, or `gtfs.geojson.shapes()` for one line per shape                                   |
| `getServiceIdsByDate(date)`                   | The [calendar query below](#service-ids-without-trips)                                                                                                  |
| `isGtfsValidationError(error)`                | `isGtfsError(error) && error.category === 'validation'`                                                                                                 |
| `formatGtfsError(error, { verbosity })`       | `formatGtfsError(error, { audience })`                                                                                                                  |
| `prepDirectory(path)`                         | Let export manage its output, or use `node:fs/promises` for an application-owned directory; v4 deleted existing contents                                |
| `unzip(path, output)`                         | Pass the ZIP directly to import; use a separate archive library for general extraction                                                                  |
| `generateFolderName(name)`                    | Set `export.outputDirectory` explicitly, or choose your application's own filename policy                                                               |
| `untildify(path)`                             | Use an absolute path or construct a path with `node:os` `homedir()` and `node:path`                                                                     |

`importGtfsToKysely` options `manageSchema` and `includeNodeGtfsExtras` have no
direct equivalents. Import ensures the enabled managed tables and always uses
their source keys and generated columns. If passing an existing transaction,
prepare its schema first as described in [database setup](../databases.md).

For example, replace `advancedQuery` with an awaited callback and include source
identity explicitly:

```ts
import type { Gtfs } from 'gtfs';

export async function routesWithTrips(gtfs: Gtfs, sourceId: string) {
  return gtfs.database.withKysely({
    callback: (database) =>
      database
        .selectFrom('routes')
        .innerJoin('trips', (join) =>
          join
            .onRef('trips.source_id', '=', 'routes.source_id')
            .onRef('trips.route_id', '=', 'routes.route_id'),
        )
        .where('routes.source_id', '=', sourceId)
        .select(['routes.route_id', 'trips.trip_id'])
        .execute(),
  });
}
```

Standalone operations share the same client configuration:

```ts
import { importGtfs, exportGtfs, refreshGtfsRealtime } from 'gtfs';
import type { Gtfs, GtfsImportOptions } from 'gtfs';

export async function replaceAndExport(
  database: GtfsImportOptions['database'],
) {
  const imported = await importGtfs({
    database,
    sources: [{ sourceId: 'metro', schedule: { path: './feed.zip' } }],
  });
  const exported = await exportGtfs({
    database,
    export: { sourceId: 'metro', outputDirectory: './metro-export' },
  });
  return { imported, exported };
}

export async function refresh(database: GtfsImportOptions['database']) {
  return refreshGtfsRealtime({
    database,
    extensions: ['gtfs-realtime'],
    sources: [
      {
        sourceId: 'metro',
        realtime: {
          feeds: [{ type: 'alerts', url: 'https://example.test/alerts.pb' }],
        },
      },
    ],
  });
}

export async function mapRoute(gtfs: Gtfs, routeId: string) {
  const stops = await gtfs.geojson.stops({ routeId });
  const routes = await gtfs.geojson.routes({ where: { route_id: routeId } });
  const shapes = await gtfs.geojson.shapes({ routeId });
  return { stops, routes, shapes };
}
```

Do not use standalone import followed by another call with `path: ":memory:"`:
the first database is closed before the next call. Use a file or borrowed client,
or keep a `Gtfs` instance open.

## Service IDs without trips

If you need trips operating on a date, use `gtfs.query.activeTrips({ serviceDate })`.
To replace `getServiceIdsByDate()` exactly, including service IDs with no trips,
combine both calendar files instead. This example expects a valid `YYYYMMDD` date
and existing Schedule tables:

```ts
import type { Gtfs } from 'gtfs';

export async function serviceIdsForDate(
  gtfs: Gtfs,
  sourceId: string,
  date: number,
) {
  const weekdays = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const text = String(date);
  const weekday =
    weekdays[
      new Date(
        `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00Z`,
      ).getUTCDay()
    ];
  if (weekday === undefined) {
    throw new Error('A valid YYYYMMDD date is required');
  }
  const rows = await gtfs.database.withKysely({
    callback: (database) =>
      database
        .selectFrom(
          database
            .selectFrom('calendar')
            .select('service_id')
            .where('source_id', '=', sourceId)
            .where('start_date', '<=', date)
            .where('end_date', '>=', date)
            .where(weekday, '=', 1)
            .union(
              database
                .selectFrom('calendar_dates')
                .select('service_id')
                .where('source_id', '=', sourceId)
                .where('date', '=', date)
                .where('exception_type', '=', 1),
            )
            .as('active'),
        )
        .select('service_id')
        .where(
          'service_id',
          'not in',
          database
            .selectFrom('calendar_dates')
            .select('service_id')
            .where('source_id', '=', sourceId)
            .where('date', '=', date)
            .where('exception_type', '=', 2),
        )
        .orderBy('service_id')
        .execute(),
  });
  return rows.map(({ service_id }) => service_id);
}
```

## Row types

Import these types from `gtfs` or `gtfs/schema`. V5 filename-based types
describe default public results; use `GtfsStoredTableRow<TableName>` for
physical database rows. Even unchanged type names can have different fields
and value representations.

| V4                           | V5                            |
| ---------------------------- | ----------------------------- |
| `Agency`                     | `Agency`                      |
| `Area`                       | `Areas`                       |
| `Attribution`                | `Attributions`                |
| `BookingRule`                | `BookingRules`                |
| `Calendar`                   | `Calendar`                    |
| `CalendarDate`               | `CalendarDates`               |
| `FareAttribute`              | `FareAttributes`              |
| `FareLegJoinRule`            | `FareLegJoinRules`            |
| `FareLegRule`                | `FareLegRules`                |
| `FareMedia`                  | `FareMedia`                   |
| `FareProduct`                | `FareProducts`                |
| `FareRule`                   | `FareRules`                   |
| `FareTransferRule`           | `FareTransferRules`           |
| `FeedInfo`                   | `FeedInfo`                    |
| `Frequency`                  | `Frequencies`                 |
| `Level`                      | `Levels`                      |
| `LocationGroupStop`          | `LocationGroupStops`          |
| `LocationGroup`              | `LocationGroups`              |
| `Location`                   | `Locations`                   |
| `Network`                    | `Networks`                    |
| `Pathway`                    | `Pathways`                    |
| `RiderCategory`              | `RiderCategories`             |
| `RouteNetwork`               | `RouteNetworks`               |
| `Route`                      | `Routes`                      |
| `Shape`                      | `Shapes`                      |
| `StopArea`                   | `StopAreas`                   |
| `StopTime`                   | `StopTimes`                   |
| `Stop`                       | `Stops`                       |
| `Timeframe`                  | `Timeframes`                  |
| `Transfer`                   | `Transfers`                   |
| `Translation`                | `Translations`                |
| `Trip`                       | `Trips`                       |
| `ServiceAlertInformedEntity` | `RealtimeAlertEntitySelector` |
| `ServiceAlertRow`            | `RealtimeAlert`               |
| `StopTimeUpdate`             | `RealtimeStopTimeUpdate`      |
| `TripUpdate`                 | `RealtimeTripUpdate`          |
| `VehiclePosition`            | `RealtimeVehiclePosition`     |
| `CalendarAttribute`          | `CalendarAttributes`          |
| `Direction`                  | `Directions`                  |
| `RouteAttribute`             | `RouteAttributes`             |
| `StopAttribute`              | `StopAttributes`              |
| `BoardAlight`                | `BoardAlight`                 |
| `RideFeedInfo`               | `RideFeedInfo`                |
| `RiderTrip`                  | `RiderTrip`                   |
| `Ridership`                  | `Ridership`                   |
| `TripCapacity`               | `TripCapacity`                |
| `TimetableNote`              | `TimetableNotes`              |
| `TimetableNotesReference`    | `TimetableNotesReferences`    |
| `TimetablePage`              | `TimetablePages`              |
| `TimetableStopOrder`         | `TimetableStopOrder`          |
| `Timetable`                  | `Timetables`                  |
| `TripsDatedVehicleJourney`   | Application-owned type        |
| `DeadheadTime`               | `DeadheadTimes`               |
| `Deadhead`                   | `Deadheads`                   |
| `OpsLocation`                | `OpsLocations`                |
| `RunEvent`                   | `RunEvent`                    |
| `RunPiece`                   | `RunsPieces`                  |
| `Device`                     | `Devices`                     |
| `FareTransaction`            | `FareTransactions`            |
| `Operator`                   | `Operators`                   |
| `PassengerEvent`             | `PassengerEvents`             |
| `StationActivity`            | `StationActivities`           |
| `StopVisit`                  | `StopVisits`                  |
| `TrainCar`                   | `TrainCars`                   |
| `TripPerformed`              | `TripsPerformed`              |
| `VehicleLocation`            | `VehicleLocations`            |
| `VehicleTrainCar`            | `VehicleTrainCars`            |
| `Vehicle`                    | `Vehicles`                    |

## Configuration, query, and schema types

| V4 type/export                                                                                                    | V5 choice                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GtfsSqliteImportConfig`, `GtfsImportConfig`, `ImportConfigWithReport`, `SqliteImportConfigWithReport`            | `GtfsImportOptions` for standalone import; `GtfsInstanceOptions` for instances                                                     |
| `GtfsExportConfig`                                                                                                | `GtfsExportOptions` for standalone export; `GtfsExportConfig` now describes the nested export settings                             |
| `GtfsRealtimeConfig`                                                                                              | `GtfsRealtimeRefreshOptions` for standalone refresh; current `GtfsRealtimeConfig` describes nested retention settings              |
| `SqliteConnectionOptions`                                                                                         | `GtfsDatabaseConfig`                                                                                                               |
| `GtfsFeedConfig`                                                                                                  | `GtfsScheduleImportSourceConfig`                                                                                                   |
| `GtfsRealtimeFeedConfig`                                                                                          | `GtfsSourceConfig` containing `realtime`; the current `GtfsRealtimeFeedConfig` represents one GTFS-Realtime feed                   |
| `GtfsRealtimeEndpoint`                                                                                            | `GtfsRealtimeFeedConfig`                                                                                                           |
| `DownloadOptions`                                                                                                 | Set `timeoutMs` on the relevant Schedule/GTFS-Realtime URL input                                                                   |
| `ImportBehaviorOptions`                                                                                           | `GtfsScheduleImportConfig`                                                                                                         |
| `KyselyImportOptions`, `KyselyImportDialect`                                                                      | Pass `database.client`; infer the client type through Kysely                                                                       |
| `ReportingOptions`, `LogLevel`, `LogMessageLevel`, `LogFunction`                                                  | `GtfsReportingConfig`, `GtfsReportingLevel`, `GtfsLogMessageLevel`, `GtfsReporter`                                                 |
| `ImportReport`                                                                                                    | `GtfsImportResult`                                                                                                                 |
| `GtfsWarning`, `GtfsWarningCode`                                                                                  | `GtfsValidationNotice`, `GtfsValidationNoticeCode`                                                                                 |
| `RowQuery<Row>`, `DynamicQuery`                                                                                   | `GtfsEqualityFilter<TableName>` for readers; Kysely expressions for SQL                                                            |
| `RowOrderBy<Row>`, `SortDirection`                                                                                | `GtfsFieldOrder<TableName>[]`, `GtfsSortDirection`                                                                                 |
| `QueryScalar`                                                                                                     | `GtfsQueryValue`, with field-specific types enforced by equality filters                                                           |
| `SelectedRow<Row, Fields>`                                                                                        | Infer selected results, or use TypeScript `Pick<Row, Fields>`                                                                      |
| `SqliteQueryOptions`, `StopQueryOptions`                                                                          | Instance database config; `GtfsStopsQueryOptions` for supported stop semantics                                                     |
| `AdvancedQueryOptions`, `AdvancedQueryJoin`, `AdvancedQueryJoinType`, `DynamicQueryResult`, `DatabaseResultValue` | Typed Kysely queries and inferred result types                                                                                     |
| `GtfsTableRow<TableName>`                                                                                         | `GtfsStoredTableRow<TableName>`                                                                                                    |
| `GtfsRow<Definition>`                                                                                             | `GtfsNormalizedRow<Definition>` from `gtfs/schema`                                                                                 |
| `GtfsInsert<Definition>`, `GtfsQuery<Definition>`                                                                 | `GtfsInsertRow<Definition>`, `GtfsStoredRowFilter<Definition>` from `gtfs/schema`; current root `GtfsQuery<TableName>` is a reader |
| `GtfsNamespace`, `gtfsNamespaces`                                                                                 | `GtfsSpecification`, `gtfsSpecifications`; use `GtfsExtension`, `gtfsExtensions` for optional formats                              |
| `GtfsStorageDefinition`                                                                                           | Inspect the managed table's storage metadata through `gtfsManifest`; use Kysely migrations for application-owned schemas           |
| `GtfsValuePresence`                                                                                               | `GtfsPresence` from `gtfs/schema`                                                                                                  |

Schema definitions, `defineGtfsTable`, `gtfsManifest`, `gtfsJoins`,
`gtfsScheduleReferenceRevision`, table constants, and `tables` are imported from
`gtfs/schema`. Replace `gtfs/models` imports with `gtfs/schema`. Do not assume
old physical table definitions or storage policies apply to a new database.
Schema field metadata uses `supportsCaseInsensitiveComparison`, not
`caseInsensitiveComparison`. GTFS reference metadata is not a promise that
physical foreign keys are enforced.

```ts
import type {
  GtfsImportOptions,
  GtfsEqualityFilter,
  GtfsFieldOrder,
  Routes,
} from 'gtfs';
import { gtfsManifest } from 'gtfs/schema';
import type { GtfsDatabase, GtfsStoredTableRow } from 'gtfs/schema';

const options: GtfsImportOptions = {
  database: { path: './transit-v5.sqlite' },
  sources: [{ sourceId: 'metro', schedule: { path: './feed.zip' } }],
};
const where: GtfsEqualityFilter<'routes'> = { route_id: 'red' };
const order: GtfsFieldOrder<'routes'>[] = [
  { field: 'route_id', direction: 'asc' },
];
type PublicRoute = Routes;
type StoredStopTime = GtfsStoredTableRow<'stop_times'>;
type Database = GtfsDatabase;
console.log(options, where, order, gtfsManifest.routes.filename);
```

## GTFS-Realtime fields and types

| V4 field/table                                                             | V5                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `service_alerts`                                                           | `alerts`                                                                  |
| `service_alert_informed_entities`                                          | `alert_entity_selectors`                                                  |
| `stop_time_updates`                                                        | `trip_update_stop_time_updates`                                           |
| Entity `id`                                                                | `entity_id` on current entity tables; child parent keys remain contextual |
| `created_timestamp`                                                        | `created_at_unix_seconds`                                                 |
| `expiration_timestamp`                                                     | `expires_at_unix_seconds`                                                 |
| Stop update `arrival_timestamp`, `departure_timestamp`                     | `arrival_unix_seconds`, `departure_unix_seconds`                          |
| Stop update `arrival_scheduled_timestamp`, `departure_scheduled_timestamp` | `arrival_scheduled_unix_seconds`, `departure_scheduled_unix_seconds`      |
| Vehicle `vehicle_stop_status`                                              | `current_status`                                                          |
| Trip update `start_date`                                                   | `trip_start_date`                                                         |

Every GTFS-Realtime identity also includes `source_id` and `realtime_feed_id`.
See the [full field reference](gtfs-realtime.md) for the new history and child
tables. The `GtfsRealtime*` enum type names remain available, as does
`TimetableNoteScope`; accepted values come from the current specification.

The composed `ServiceAlert` type has no direct replacement. Query `RealtimeAlert`
and `RealtimeAlertEntitySelector` separately, matching source ID, GTFS-Realtime feed ID and
`alert_id`/`entity_id`; use the [SQL join examples](../sql-queries.md#joining-related-records).
The getter replacement above returns alert rows, not nested selectors.

## Error codes

`GtfsError`, `GtfsErrorCategory` and `isGtfsError` remain available. Constant keys
on `GtfsErrorCode` drop the `GTFS_` prefix; for example,
`GtfsErrorCode.GTFS_QUERY_INVALID` becomes `GtfsErrorCode.QUERY_INVALID`.
Most string values retain that prefix. These string values change:

| V4 code string                | V5 code string                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GTFS_DOWNLOAD_HTTP`          | `GTFS_DOWNLOAD_HTTP_FAILED`                                                                                         |
| `GTFS_REQUIRED_FIELD_MISSING` | `GTFS_REQUIRED_VALUE_MISSING` for normalization failures; validation notices distinguish missing headers and values |
| `DB_OPEN_FAILED`              | `GTFS_DATABASE_OPEN_FAILED`                                                                                         |
| `GTFS_DB_OPERATION_FAILED`    | `GTFS_DATABASE_OPERATION_FAILED`                                                                                    |

The old duplicate warning maps to
`GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY`. Its string value remains
`GTFS_DUPLICATE_PRIMARY_KEY`; read it in validation notices rather than
`result.warnings`. Error category, cause and diagnostic positions remain
available for handling failures.

## Next steps

- [Follow the migration and database cutover guide](../migrating-to-v5.md).
- [Convert configuration options](../migrating-to-v5.md#convert-configuration).
- [Query and stream records](../queries.md).
- [Look up current fields and row types](../data-model.md).
- [Update GTFS-Realtime refreshes and queries](../realtime.md).
