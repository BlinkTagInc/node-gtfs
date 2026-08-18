# Query API guide

The built-in query helpers read SQLite synchronously. Open the database once
and close it when the work is complete. When exactly one database is open,
query helpers use it automatically:

```js
import { closeDb, getRoutes, openDb } from 'gtfs';

openDb({ sqlitePath: './gtfs.sqlite' });

try {
  const routes = getRoutes(
    {},
    ['route_id', 'route_short_name'],
    [['route_short_name', 'ASC']],
  );
  console.table(routes);
} finally {
  closeDb();
}
```

Example output (values depend on the imported feed):

```text
┌─────────┬─────────────┬──────────────────┐
│ (index) │ route_id    │ route_short_name │
├─────────┼─────────────┼──────────────────┤
│ 0       │ 'route-1'   │ '1'              │
│ 1       │ 'route-101' │ '101'            │
└─────────┴─────────────┴──────────────────┘
```

Pass `{ db }` in the fourth argument when more than one database is open or
when you want to make the selected connection explicit.

## Common arguments

Query helpers use this shape:

```js
getRoutes(query, fields, orderBy, options);
```

All four arguments are optional. Supply empty objects or arrays when you need a
later argument.

### `query`

An object of column/value filters. Multiple properties are combined with
`AND`:

```js
const trips = getTrips({ route_id: '12', direction_id: 0 });
```

An array produces an `IN` query. An empty array always returns no records:

```js
const stops = getStops({ stop_id: ['123', '234', '345'] });
```

### `fields`

An array of columns to return. An empty array selects every column:

```js
const routes = getRoutes({}, ['route_id', 'route_short_name']);
```

In TypeScript, selected fields narrow the inferred result type.

### `orderBy`

An array of `[field, direction]` pairs. The direction must be `ASC` or `DESC`:

```js
const routes = getRoutes(
  {},
  [],
  [
    ['route_short_name', 'ASC'],
    ['route_long_name', 'ASC'],
  ],
);
```

### `options`

All getters accept `{ db }`. Stop queries also accept
`bounding_box_side_m`.

```js
const nearbyStops = getStops(
  { stop_lat: 37.7749, stop_lon: -122.4194 },
  [],
  [],
  {
    db,
    bounding_box_side_m: 1000,
  },
);
```

## Query helpers by namespace

Most functions query the table corresponding to the function name with the
four-argument signature shown above. Specialized helpers are described below.

### GTFS Schedule

| Function                | GTFS File                            |
| ----------------------- | ------------------------------------ |
| `getAgencies`           | `agency.txt`                         |
| `getAreas`              | `areas.txt`                          |
| `getAttributions`       | `attributions.txt`                   |
| `getBookingRules`       | `booking_rules.txt`                  |
| `getCalendars`          | `calendar.txt`                       |
| `getCalendarDates`      | `calendar_dates.txt`                 |
| `getServiceIdsByDate`   | `calendar.txt`, `calendar_dates.txt` |
| `getFareAttributes`     | `fare_attributes.txt`                |
| `getFareLegJoinRules`   | `fare_leg_join_rules.txt`            |
| `getFareLegRules`       | `fare_leg_rules.txt`                 |
| `getFareMedia`          | `fare_media.txt`                     |
| `getFareProducts`       | `fare_products.txt`                  |
| `getFareRules`          | `fare_rules.txt`                     |
| `getFareTransferRules`  | `fare_transfer_rules.txt`            |
| `getFeedInfo`           | `feed_info.txt`                      |
| `getFrequencies`        | `frequencies.txt`                    |
| `getLevels`             | `levels.txt`                         |
| `getLocations`          | `locations.geojson`                  |
| `getLocationGroups`     | `location_groups.txt`                |
| `getLocationGroupStops` | `location_group_stops.txt`           |
| `getNetworks`           | `networks.txt`                       |
| `getPathways`           | `pathways.txt`                       |
| `getRiderCategories`    | `rider_categories.txt`               |
| `getRoutes`             | `routes.txt`                         |
| `getRouteNetworks`      | `route_networks.txt`                 |
| `getShapes`             | `shapes.txt`                         |
| `getShapesAsGeoJSON`    | `shapes.txt`                         |
| `getStopAreas`          | `stop_areas.txt`                     |
| `getStops`              | `stops.txt`                          |
| `getStopsAsGeoJSON`     | `stops.txt`                          |
| `getStoptimes`          | `stop_times.txt`                     |
| `getTimeframes`         | `timeframes.txt`                     |
| `getTransfers`          | `transfers.txt`                      |
| `getTranslations`       | `translations.txt`                   |
| `getTrips`              | `trips.txt`                          |

### GTFS-Realtime

GTFS-Realtime uses protocol buffer entities rather than `.txt` files.

| Function                          | GTFS File                              |
| --------------------------------- | -------------------------------------- |
| `getServiceAlerts`                | GTFS-Realtime `Alert` entity           |
| `getServiceAlertInformedEntities` | `Alert.informed_entity`                |
| `getTripUpdates`                  | GTFS-Realtime `TripUpdate` entity      |
| `getStopTimeUpdates`              | `TripUpdate.stop_time_update`          |
| `getVehiclePositions`             | GTFS-Realtime `VehiclePosition` entity |

### GTFS-Plus

| Function                | GTFS File                 |
| ----------------------- | ------------------------- |
| `getCalendarAttributes` | `calendar_attributes.txt` |
| `getDirections`         | `directions.txt`          |
| `getRouteAttributes`    | `route_attributes.txt`    |
| `getStopAttributes`     | `stop_attributes.txt`     |

### GTFS-Ride

| Function            | GTFS File            |
| ------------------- | -------------------- |
| `getBoardAlights`   | `board_alight.txt`   |
| `getRideFeedInfo`   | `ride_feed_info.txt` |
| `getRiderTrips`     | `rider_trip.txt`     |
| `getRidership`      | `ridership.txt`      |
| `getTripCapacities` | `trip_capacity.txt`  |

### GTFS-to-HTML

| Function                      | GTFS File                        |
| ----------------------------- | -------------------------------- |
| `getTimetableNotes`           | `timetable_notes.txt`            |
| `getTimetableNotesReferences` | `timetable_notes_references.txt` |
| `getTimetablePages`           | `timetable_pages.txt`            |
| `getTimetableStopOrders`      | `timetable_stop_order.txt`       |
| `getTimetables`               | `timetables.txt`                 |

### TODS

| Function           | GTFS File            |
| ------------------ | -------------------- |
| `getDeadheadTimes` | `deadhead_times.txt` |
| `getDeadheads`     | `deadheads.txt`      |
| `getOpsLocations`  | `ops_locations.txt`  |
| `getRunEvents`     | `run_event.txt`      |
| `getRunsPieces`    | `runs_pieces.txt`    |

### NOPTIS

| Function                       | GTFS File                         |
| ------------------------------ | --------------------------------- |
| `getTripsDatedVehicleJourneys` | `trips_dated_vehicle_journey.txt` |

### TIDES

| Function               | GTFS File                |
| ---------------------- | ------------------------ |
| `getDevices`           | `devices.txt`            |
| `getFareTransactions`  | `fare_transactions.txt`  |
| `getOperators`         | `operators.txt`          |
| `getPassengerEvents`   | `passenger_events.txt`   |
| `getStationActivities` | `station_activities.txt` |
| `getStopVisits`        | `stop_visits.txt`        |
| `getTrainCars`         | `train_cars.txt`         |
| `getTripsPerformed`    | `trips_performed.txt`    |
| `getVehicleLocations`  | `vehicle_locations.txt`  |
| `getVehicleTrainCars`  | `vehicle_train_cars.txt` |
| `getVehicles`          | `vehicles.txt`           |

## Specialized queries

### Routes by stop or service

`getRoutes()` accepts `stop_id` and `service_id` in addition to fields from
`routes.txt`:

```js
const routes = getRoutes(
  { stop_id: 'place-downtown' },
  ['route_id', 'route_short_name'],
  [['route_short_name', 'ASC']],
  { db },
);
```

### Stops by trip data

`getStops()` accepts `route_id`, `trip_id`, `service_id`, `direction_id`, and
`shape_id` in addition to fields from `stops.txt`:

```js
const stops = getStops(
  { route_id: '12', direction_id: 0 },
  ['stop_id', 'stop_name'],
  [['stop_name', 'ASC']],
  { db },
);
```

To find stops near a point, provide `stop_lat`, `stop_lon`, and the side length
of a square bounding box in meters:

```js
const nearbyStops = getStops(
  { stop_lat: 37.7749, stop_lon: -122.4194 },
  ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
  [],
  { db, bounding_box_side_m: 1000 },
);
```

When no `orderBy` is supplied, bounding-box results are ordered by approximate
distance from the provided point.

### Trips by date

`getTrips()` accepts `date` as a `YYYYMMDD` number and matches service from
`calendar.txt` and `calendar_dates.txt`:

```js
const trips = getTrips(
  { route_id: '12', date: 20260817 },
  ['trip_id', 'service_id'],
  [],
  { db },
);
```

`getServiceIdsByDate(date, options)` returns only the service IDs active on a
date.

### Stop times by date or time window

`getStoptimes()` accepts `date`, `start_time`, and `end_time` in addition to
fields from `stop_times.txt`. GTFS times may be later than `23:59:59`:

```js
const stopTimes = getStoptimes(
  {
    date: 20260817,
    start_time: '08:00:00',
    end_time: '09:00:00',
  },
  ['trip_id', 'stop_id', 'arrival_time', 'departure_time'],
  [['departure_time', 'ASC']],
  { db },
);
```

### Shapes by trip data

`getShapes()` accepts `route_id`, `trip_id`, `service_id`, and `direction_id`
in addition to fields from `shapes.txt`.

### GeoJSON

`getStopsAsGeoJSON(query, options)` returns a GeoJSON `FeatureCollection` of
stops. `getShapesAsGeoJSON(query, options)` returns route shapes as GeoJSON.

```js
import { getShapesAsGeoJSON } from 'gtfs';

const geojson = getShapesAsGeoJSON({ route_id: '12' }, { db });
```

## Case-insensitive SQLite comparisons

Schema fields marked `caseInsensitiveComparison` use SQLite's
`COLLATE NOCASE`. Equality, `IN`, and default ordering ignore ASCII letter
case. GTFS IDs remain case-sensitive.

SQLite `NOCASE` is not Unicode-aware. Raw SQL can request another collation:

```sql
SELECT *
FROM agency
WHERE agency_name COLLATE BINARY = ?;
```

## Advanced queries

`advancedQuery(table, options)` supports dynamic fields, filters, ordering, and
joins:

```js
import { advancedQuery } from 'gtfs';

const rows = advancedQuery('trips', {
  db,
  fields: ['trips.trip_id', 'routes.route_short_name'],
  query: { 'routes.route_type': 3 },
  join: [
    {
      type: 'INNER',
      table: 'routes',
      on: 'trips.route_id = routes.route_id',
    },
  ],
  orderBy: [['routes.route_short_name', 'ASC']],
});
```

The `join.on` expression is raw SQL. Do not construct it from untrusted input.
For queries beyond this interface, use the `better-sqlite3` connection:

```js
const rows = db
  .prepare('SELECT trip_id FROM trips WHERE route_id = ? ORDER BY trip_id')
  .all('12');
```

## Closing or deleting a database

Use `closeDb()` when you are finished with a connection. Pass the connection
explicitly if the application has more than one database open:

```js
import { closeDb, getAgencies, openDb } from 'gtfs';

const db = openDb({ sqlitePath: './gtfs.sqlite' });

try {
  const agencies = getAgencies({}, [], [], { db });
  console.table(agencies);
} finally {
  closeDb(db);
}
```

`deleteDb()` closes the connection and permanently deletes its file-backed
SQLite database:

```js
import { deleteDb, openDb } from 'gtfs';

const db = openDb({ sqlitePath: './temporary-gtfs.sqlite' });

// Use the temporary database.

deleteDb(db);
```

Do not use `deleteDb()` unless the database file is no longer needed. For an
in-memory database, it closes the connection without deleting a file.
