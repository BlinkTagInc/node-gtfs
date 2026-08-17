# Configuration reference

node-GTFS accepts configuration objects in JavaScript and JSON configuration
files on the command line. Relative paths are resolved from the directory where
the process is started.

The repository includes three starting points:

- [`config-sample.json`](../config-sample.json) for a minimal static import
- [`config-sample-full.json`](../config-sample-full.json) for every current,
  recommended JSON option
- [`config-sample-rtupdates.json`](../config-sample-rtupdates.json) for a
  realtime-only update

Replace the example URLs, credentials, and paths before using the full samples.
The `db` and `logFunction` options are JavaScript values and cannot be stored in
JSON. The deprecated `verbose` option is omitted; use `logLevel` instead.

Below is a minimal configuration:

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip"
    }
  ],
  "sqlitePath": "./data/gtfs.sqlite"
}
```

`agencies` is required for static imports. `sqlitePath` is strongly recommended
for command-line use because the default is an in-memory database.

> **Warning:** A static import drops and recreates the GTFS tables in its
> destination database. It does not preserve changes made directly to those
> tables. Use a new database or create a backup before importing.

## Top-level options

| Option                          | Type                      | Default    | Used by                      | Description                                   |
| ------------------------------- | ------------------------- | ---------- | ---------------------------- | --------------------------------------------- |
| `agencies`                      | array                     | required   | import, realtime             | GTFS feeds to process                         |
| `sqlitePath`                    | string                    | `:memory:` | SQLite operations            | SQLite database path                          |
| `db`                            | `better-sqlite3` database | none       | JavaScript SQLite operations | Existing connection to use                    |
| `csvOptions`                    | object                    | `{}`       | static import                | Options passed to `csv-parse`                 |
| `downloadTimeout`               | number                    | `30000`    | import, realtime             | Download timeout in milliseconds              |
| `exportPath`                    | string                    | generated  | export                       | Directory for exported files                  |
| `gtfsRealtimeExpirationSeconds` | number                    | `0`        | realtime                     | Age at which old realtime rows may be deleted |
| `ignoreDuplicates`              | boolean                   | `false`    | static import                | Skip rows that violate a unique key           |
| `ignoreErrors`                  | boolean                   | `false`    | import, realtime             | Log an error and continue where supported     |
| `includeImportReport`           | boolean                   | `false`    | static import                | Return an `ImportReport` from JavaScript      |
| `logLevel`                      | string                    | `info`     | all operations               | `silent`, `error`, `warning`, or `info`       |
| `logFunction`                   | function                  | console    | JavaScript operations        | Receive non-progress log messages             |
| `verbose`                       | boolean                   | none       | all operations               | Deprecated; use `logLevel`                    |

You can add your own unrelated config options - unknown
keys are ignored, although likely misspellings of known options produce a
warning.

## Feed options

Each static feed must have exactly one `url` or `path`.

| Option                     | Type         | Description                                             |
| -------------------------- | ------------ | ------------------------------------------------------- |
| `url`                      | string       | URL of a GTFS ZIP file                                  |
| `path`                     | string       | Local ZIP file or directory containing GTFS files       |
| `headers`                  | object       | HTTP request headers for the static feed                |
| `prefix`                   | string       | Prefix applied to identifiers when feeds are merged     |
| `exclude`                  | string array | Database table names to skip, without `.txt`            |
| `fillEmptyAgencyId`        | boolean      | Fill missing `agency_id` values in a single-agency feed |
| `agencyId`                 | string       | Fallback ID used with `fillEmptyAgencyId`               |
| `realtimeAlerts`           | object       | Alert endpoint and optional headers                     |
| `realtimeTripUpdates`      | object       | Trip update endpoint and optional headers               |
| `realtimeVehiclePositions` | object       | Vehicle position endpoint and optional headers          |

### Import from a URL

```json
{
  "agencies": [
    {
      "url": "https://www.bart.gov/dev/schedules/google_transit.zip"
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

### Import from a ZIP file or directory

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip"
    }
  ],
  "sqlitePath": "./data/gtfs.sqlite"
}
```

Change `path` to a directory such as `./data/unzipped-gtfs` when the feed has
already been extracted.

### Send HTTP headers

```json
{
  "agencies": [
    {
      "url": "https://example.com/gtfs.zip",
      "headers": {
        "Authorization": "Bearer replace-with-your-token"
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

Do not commit credentials to source control. Load configuration from a secure
location in production.

### Merge multiple feeds

Use a different prefix for each feed when their identifiers may overlap:

```json
{
  "agencies": [
    {
      "path": "./data/north.zip",
      "prefix": "north"
    },
    {
      "path": "./data/south.zip",
      "prefix": "south"
    }
  ],
  "sqlitePath": "./regional.sqlite"
}
```

Only schema fields marked `applyFeedPrefix` are changed. The prefix is also
applied to corresponding references.

### Exclude large or unused tables

`exclude` uses database table names, not filenames:

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip",
      "exclude": ["shapes", "fare_attributes"]
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

### Fill empty agency IDs

Some valid single-agency feeds leave `agency_id` blank throughout the GTFS.
Set `fillEmptyAgencyId` to fill those values:

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip",
      "fillEmptyAgencyId": true,
      "agencyId": "metro-transit"
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

An ID found in `agency.txt` takes precedence over `agencyId`.

### Import GTFS-realtime data too

```json
{
  "agencies": [
    {
      "url": "https://svc.metrotransit.org/mtgtfs/gtfs.zip",
      "realtimeAlerts": {
        "url": "https://svc.metrotransit.org/mtgtfs/alerts.pb"
      },
      "realtimeTripUpdates": {
        "url": "https://svc.metrotransit.org/mtgtfs/tripupdates.pb"
      },
      "realtimeVehiclePositions": {
        "url": "https://svc.metrotransit.org/mtgtfs/vehiclepositions.pb"
      }
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

See the [GTFS-Realtime guide](realtime.md) for more details.

## Existing SQLite connection

Pass a caller-owned `better-sqlite3` connection with `db`. This is available
only from JavaScript, not JSON:

```js
import Database from 'better-sqlite3';
import { importGtfs } from 'gtfs';

const db = new Database('./data/gtfs.sqlite');

try {
  await importGtfs({
    agencies: [{ path: './data/gtfs.zip' }],
    db,
  });
} finally {
  db.close();
}
```

The caller remains responsible for the connection lifecycle.

## CSV parser options

`csvOptions` is passed to [`csv-parse`](https://csv.js.org/parse/options/).
For example:

```json
{
  "agencies": [{ "path": "./data/gtfs.zip" }],
  "sqlitePath": "./gtfs.sqlite",
  "csvOptions": {
    "skip_empty_lines": true
  }
}
```

Parser options can change which data is accepted. Validate the resulting
record counts when relaxing parsing behavior.

## Error handling

With `ignoreErrors: false`, an import stops at the first error. With
`ignoreErrors: true`, node-GTFS logs errors and continues with later work where
possible. A parser or database error can cause the rest of the current file or
batch to be skipped, and previously committed batches remain in the database.
The result may therefore be partial.

Use `includeImportReport` in JavaScript to inspect the result:

```js
import { importGtfs } from 'gtfs';

const report = await importGtfs({
  agencies: [{ path: './data/gtfs.zip' }],
  sqlitePath: './gtfs.sqlite',
  ignoreErrors: true,
  includeImportReport: true,
});

console.log(report.errors);
```

In TypeScript, the literal `includeImportReport: true` changes the return type
to `Promise<ImportReport>`.

`ignoreDuplicates` skips records that violate a declared unique key. It does
not make other parse or database errors non-fatal.

## Logging

`logLevel` accepts `silent`, `error`, `warning`, or `info`. Errors and warnings
use stderr; normal status output uses stdout.

JavaScript applications can redirect non-progress messages:

```js
import { importGtfs } from 'gtfs';

await importGtfs({
  agencies: [{ path: './data/gtfs.zip' }],
  sqlitePath: './gtfs.sqlite',
  logLevel: 'warning',
  logFunction(level, message) {
    console.log(`[${level}] ${message}`);
  },
});
```

`verbose` remains available for compatibility. Use `logLevel` in new code.

## Export path

If `exportPath` is omitted, exports go to
`gtfs-export/<first-agency-name>` under the current directory. The export
directory is cleared before files are written.

```json
{
  "sqlitePath": "./gtfs.sqlite",
  "exportPath": "./output/gtfs"
}
```

## Command-line precedence

The commands look for `./config.json` in the current working directory unless
`--configPath` is supplied. Direct command-line options override values with
the same name in the selected configuration file.

```bash
npx gtfs-import \
  --configPath ./config.json \
  --sqlitePath ./temporary.sqlite \
  --logLevel warning
```

Run a command with `--help` for its current options.
