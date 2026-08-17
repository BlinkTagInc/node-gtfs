# GTFS-Realtime guide

node-GTFS can download and store GTFS-Realtime alerts, trip updates, and
vehicle positions in SQLite. PostgreSQL and MySQL realtime storage is not
currently supported.

## Configure endpoints

Realtime endpoints are configured inside each agency entry:

```json
{
  "agencies": [
    {
      "realtimeAlerts": {
        "url": "https://example.com/alerts.pb"
      },
      "realtimeTripUpdates": {
        "url": "https://example.com/trip-updates.pb"
      },
      "realtimeVehiclePositions": {
        "url": "https://example.com/vehicle-positions.pb"
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

A realtime-only configuration does not need a static `url` or `path`. To
import static and realtime data in one initial operation, add the static feed
to the same agency entry:

```json
{
  "agencies": [
    {
      "url": "https://example.com/gtfs.zip",
      "realtimeTripUpdates": {
        "url": "https://example.com/trip-updates.pb"
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

## Authentication headers

Each endpoint accepts its own headers:

```json
{
  "agencies": [
    {
      "realtimeVehiclePositions": {
        "url": "https://example.com/vehicle-positions.pb",
        "headers": {
          "Authorization": "Bearer replace-with-your-token"
        }
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

## Update from the command line

The updater reads `./config.json` from the current working directory:

```bash
npx gtfsrealtime-update
```

Specify another file when needed:

```bash
npx gtfsrealtime-update --configPath ./config/realtime.json
```

One invocation performs one refresh and exits. Schedule repeated invocations
with cron, a system service, a container scheduler, or a process manager.
Avoid starting a new update before the previous one has finished.

## Update from JavaScript

```js
import { updateGtfsRealtime } from 'gtfs';

await updateGtfsRealtime({
  agencies: [
    {
      realtimeTripUpdates: {
        url: 'https://example.com/trip-updates.pb',
      },
    },
  ],
  sqlitePath: './gtfs.sqlite',
});
```

## Retain older rows

By default, old realtime data can be deleted immediately when a new update
arrives. Set `gtfsRealtimeExpirationSeconds` to retain older rows for a period:

```json
{
  "agencies": [
    {
      "realtimeTripUpdates": {
        "url": "https://example.com/trip-updates.pb"
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite",
  "gtfsRealtimeExpirationSeconds": 3600
}
```

New data for the same entity can replace an existing row before that period
ends. The option controls deletion age, not entity versioning.

## Query realtime tables

The realtime getters use the same `query`, `fields`, `orderBy`, and `options`
arguments as static getters:

```js
import { closeDb, getVehiclePositions, openDb } from 'gtfs';

const db = openDb({ sqlitePath: './gtfs.sqlite' });

try {
  const vehicles = getVehiclePositions(
    { route_id: '12' },
    ['vehicle_id', 'trip_id', 'latitude', 'longitude'],
    [['vehicle_id', 'ASC']],
    { db },
  );
  console.table(vehicles);
} finally {
  closeDb(db);
}
```

Available getters are:

| Function                          | GTFS File                              |
| --------------------------------- | -------------------------------------- |
| `getServiceAlerts`                | GTFS-Realtime `Alert` entity           |
| `getServiceAlertInformedEntities` | `Alert.informed_entity`                |
| `getTripUpdates`                  | GTFS-Realtime `TripUpdate` entity      |
| `getStopTimeUpdates`              | `TripUpdate.stop_time_update`          |
| `getVehiclePositions`             | GTFS-Realtime `VehiclePosition` entity |

See the [query API guide](query-api.md) for query conventions.
