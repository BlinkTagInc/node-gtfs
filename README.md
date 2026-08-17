<p align="center">
  <img src="docs/images/node-gtfs-logo.svg" alt="node-GTFS" width="500">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gtfs"><img src="https://img.shields.io/npm/v/gtfs.svg?style=flat" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/gtfs"><img src="https://img.shields.io/npm/dm/gtfs.svg?style=flat" alt="monthly npm downloads"></a>
  <a href="https://github.com/BlinkTagInc/node-gtfs/actions?query=workflow%3A%22Node+CI%22"><img src="https://img.shields.io/github/actions/workflow/status/BlinkTagInc/node-gtfs/nodejs.yml?branch=master" alt="build status"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT license">
</p>

Import [GTFS](https://gtfs.org/schedule/) transit data into SQLite, PostgreSQL,
or MySQL. Query, update with GTFS-Realtime, and export SQLite data from Node.js
or the command line.

## Choose what you want to do

- **Import and explore a feed locally:** follow the [SQLite quick start](#quick-start).
- **Use node-GTFS in an application:** see [Using JavaScript](#using-javascript).
- **Load an existing PostgreSQL or MySQL database:** see [PostgreSQL and MySQL](#postgresql-and-mysql).
- **Refresh GTFS-Realtime data:** see [GTFS-Realtime](#gtfs-realtime).
- **Export a database back to GTFS files:** see [Export GTFS](#export-gtfs).

## Database support

| Feature                        | SQLite |     PostgreSQL      |        MySQL        |
| ------------------------------ | :----: | :-----------------: | :-----------------: |
| Import static GTFS             |  Yes   | Yes, through Kysely | Yes, through Kysely |
| Synchronous query helpers      |  Yes   |         No          |         No          |
| Import GTFS-Realtime           |  Yes   |         No          |         No          |
| Export GTFS files              |  Yes   |         No          |         No          |
| Manage GTFS tables and indexes |  Yes   |      Optional       |      Optional       |

PostgreSQL and MySQL imports use a caller-owned Kysely connection. See
[Database portability](docs/database-portability.md) for storage details.

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer

## Quick start

This example downloads BART's public GTFS feed and saves it as a persistent
SQLite database.

### 1. Create a project

```bash
mkdir gtfs-demo
cd gtfs-demo
npm init -y
npm install gtfs
```

### 2. Import GTFS

```bash
npx gtfs-import \
  --gtfsUrl https://www.bart.gov/dev/schedules/google_transit.zip \
  --sqlitePath ./gtfs.sqlite
```

The import creates `gtfs.sqlite` in the current directory. If you don't
specify a SQLite path when using the command line, it will default to an
in-memory database which will be discarded when the command exits.

> **Warning:** A static import drops and recreates the GTFS tables in its
> destination database. Use a new database or back up data you need to keep.

You can import your own ZIP file or directory instead:

```bash
npx gtfs-import --gtfsPath ./data/gtfs.zip --sqlitePath ./gtfs.sqlite
```

### 3. Query the database

Create a file named `query.mjs`:

```js
import { closeDb, getAgencies, getRoutes, openDb } from 'gtfs';

const db = openDb({ sqlitePath: './gtfs.sqlite' });

try {
  const agencies = getAgencies({}, ['agency_id', 'agency_name']);
  const routes = getRoutes(
    {},
    ['route_id', 'route_short_name', 'route_long_name'],
    [['route_short_name', 'ASC']],
  );

  console.table(agencies);
  console.table(routes);
} finally {
  closeDb(db);
}
```

Run it:

```bash
node query.mjs
```

The `.mjs` extension lets Node.js run the example as an ES module without any
additional project configuration.

## Using JavaScript

Install node-GTFS in your application:

```bash
npm install gtfs
```

Import a feed and query it in the same process using an in-memory database:

```js
import { closeDb, getStops, importGtfs, openDb } from 'gtfs';

const config = {
  agencies: [{ path: './data/gtfs.zip' }],
};

await importGtfs(config);
const db = openDb(config);

try {
  const stops = getStops(
    { stop_id: ['123', '234', '345'] },
    ['stop_id', 'stop_name'],
    [['stop_name', 'ASC']],
  );
  console.table(stops);
} finally {
  closeDb(db);
}
```

Methods that read SQLite data are synchronous. Import, export, and
GTFS-Realtime updates are asynchronous.

## Common tasks

### Use a configuration file

A configuration file is useful for multiple feeds, custom HTTP headers,
GTFS-Realtime endpoints, and other import options. Create `config.json` in the
directory where you run the command:

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

Then run:

```bash
npx gtfs-import
```

Use a configuration file in another location with `--configPath`:

```bash
npx gtfs-import --configPath ./config/production.json
```

See the [configuration reference](docs/configuration.md) for every option and
examples for multiple feeds, prefixes, exclusions, and custom logging. A
[comprehensive sample](config-sample-full.json) is also available.

### Command-line tools

Installing `gtfs` provides three commands:

| Command               | Purpose                                 |
| --------------------- | --------------------------------------- |
| `gtfs-import`         | Import static GTFS into SQLite          |
| `gtfsrealtime-update` | Refresh GTFS-Realtime data in SQLite    |
| `gtfs-export`         | Export an SQLite database to GTFS files |

Run any command with `--help` to see its options:

```bash
npx gtfs-import --help
npx gtfsrealtime-update --help
npx gtfs-export --help
```

You can install the commands globally with `npm install --global gtfs`, but a
local installation with `npx` makes it easier to keep each project on a known
version.

### Query GTFS

Most getters have the same four optional arguments:

```js
getRoutes(query, fields, orderBy, options);
```

- `query` filters rows by field. An array means SQL `IN`; an empty array
  returns no rows.
- `fields` selects returned columns. An empty array returns every column.
- `orderBy` contains `[field, 'ASC' | 'DESC']` pairs.
- `options` can contain an explicit SQLite `db` connection.

For example, find trips for a route on a service date:

```js
import { getTrips } from 'gtfs';

const trips = getTrips(
  { route_id: '12', date: 20260817 },
  ['trip_id', 'trip_headsign'],
  [['trip_headsign', 'ASC']],
  { db },
);
```

Specialized helpers support route, trip, service, time, geographic, and
GeoJSON queries. See the [query API guide](docs/query-api.md).

### Case-insensitive comparisons

Fields marked `caseInsensitiveComparison` in the schema use SQLite's
`COLLATE NOCASE`. Equality, `IN`, and default ordering ignore ASCII letter
case for those fields:

```js
const agencies = getAgencies({ agency_name: 'metro transit' });
```

GTFS identifiers remain case-sensitive. SQLite `NOCASE` is not Unicode-aware.
PostgreSQL and MySQL use the collation configured for their database or column.

### GTFS-Realtime

Add one or more realtime endpoints to a feed in `config.json`:

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

Refresh the realtime tables:

```bash
npx gtfsrealtime-update
```

The command performs one update and exits. Use your operating system's task
scheduler or a process manager to run it repeatedly. See the
[GTFS-Realtime guide](docs/realtime.md) for headers, retention, and JavaScript
usage.

### Export GTFS

Export an existing SQLite database:

```bash
npx gtfs-export --sqlitePath ./gtfs.sqlite
```

Or use JavaScript:

```js
import { exportGtfs } from 'gtfs';

await exportGtfs({
  sqlitePath: './gtfs.sqlite',
  exportPath: './gtfs-export',
});
```

The export directory is replaced when an export runs. Make sure it does not
contain files you need to keep.

### PostgreSQL and MySQL

`importGtfsToKysely()` imports static GTFS using a caller-owned Kysely
connection. Install the driver for your database in addition to `gtfs`.

PostgreSQL example:

```bash
npm install pg
```

```js
import { importGtfsToKysely } from 'gtfs';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
});

try {
  await importGtfsToKysely(
    { agencies: [{ path: './data/gtfs.zip' }] },
    { db, dialect: 'postgres' },
  );
} finally {
  await db.destroy();
}
```

> **Warning:** `manageSchema` defaults to `true`. The importer drops and
> recreates the GTFS tables it manages. Set `manageSchema: false` when your
> application owns the schema.

Use Kysely's `MysqlDialect` with `mysql2` and `dialect: 'mysql'` for MySQL.
Static Kysely imports do not store configured GTFS-Realtime feeds. See
[Database portability](docs/database-portability.md) for schema requirements
and generated columns.

## TypeScript

TypeScript declarations are included. Configuration types include:

- `GtfsSqliteImportConfig` for `importGtfs()`
- `GtfsImportConfig` for `importGtfsToKysely()`
- `GtfsExportConfig` for `exportGtfs()`
- `GtfsRealtimeConfig` for `updateGtfsRealtime()`

Getter query fields, selected fields, and return values are inferred from the
table schemas. Schema declarations and the `GtfsDatabase` Kysely type are
exported from both `gtfs` and `gtfs/schema`. See the
[schema manifest](docs/schema-manifest.md).

## Supported data

In addition to GTFS Schedule and GTFS-Realtime, node-GTFS includes schema and
import support for:

- [GTFS-Plus](https://github.com/osplanning-data-standards/GTFS-PLUS)
- [GTFS-Ride](https://gtfsride.org/)
- [GTFS-to-HTML timetable files](https://gtfstohtml.com/)
- [Transit Operational Data Standard (TODS)](https://tods-transit.org/)
- TIDES
- NOPTIS

The [query API guide](docs/query-api.md) lists the public getters. Other
imported tables can be read with SQL through the SQLite connection.

## Troubleshooting

Start with the [troubleshooting guide](docs/troubleshooting.md) if a command is
not found, the database is empty, the configuration cannot be parsed, or a
native dependency does not install. Include the node-GTFS version, Node.js
version, command, and complete error when opening an
[issue](https://github.com/BlinkTagInc/node-gtfs/issues).

## Example applications

- [GTFS-to-HTML](https://gtfstohtml.com/) generates transit timetables.
- [GTFS-to-GeoJSON](https://github.com/BlinkTagInc/gtfs-to-geojson) creates
  GeoJSON for transit routes.
- [GTFS-to-Chart](https://github.com/BlinkTagInc/gtfs-to-chart) generates
  stringline charts.
- [GTFS Accessibility Validator](https://github.com/BlinkTagInc/gtfs-accessibility-validator)
  checks accessibility-related GTFS fields.
- [GTFS Text-to-Speech](https://github.com/BlinkTagInc/gtfs-tts) tests stop
  name pronunciation.
- [Transit Departures Widget](https://github.com/BlinkTagInc/transit-departures-widget)
  displays realtime departures.
- [GTFS-to-Blocks](https://github.com/BlinkTagInc/gtfs-to-blocks) exports trip
  segments grouped by block.

## Documentation

- [Configuration reference](docs/configuration.md)
- [Query API guide](docs/query-api.md)
- [GTFS-Realtime guide](docs/realtime.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Database portability](docs/database-portability.md)
- [Schema manifest](docs/schema-manifest.md)

## Contributing

Pull requests are welcome. Run the checks before submitting a change:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm docs:check
```

node-GTFS is available under the [MIT license](LICENSE.md).
