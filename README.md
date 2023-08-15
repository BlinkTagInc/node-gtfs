<p align="center">
  ➡️
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#typescript-support">TypeScript Support</a> |
  <a href="#configuration">Configuration</a> |
  <a href="#query-methods">Query Methods</a>
  ⬅️
  <br /><br />
  <img src="docs/images/node-gtfs-logo.svg" alt="node-GTFS" />
  <br /><br />
  <a href="https://www.npmjs.com/package/gtfs" rel="nofollow"><img src="https://img.shields.io/npm/v/gtfs.svg?style=flat" style="max-width: 100%;"></a>
  <a href="https://www.npmjs.com/package/gtfs" rel="nofollow"><img src="https://img.shields.io/npm/dm/gtfs.svg?style=flat" style="max-width: 100%;"></a>
  <a href="https://github.com/BlinkTagInc/node-gtfs/actions?query=workflow%3A%22Node+CI%22"><img src="https://img.shields.io/github/actions/workflow/status/BlinkTagInc/node-gtfs/nodejs.yml?branch=master" style="max-width: 100%;"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  <br /><br />
  Import and Export GTFS transit data into SQLite. Query or change routes, stops, times, fares and more.
  <br /><br />
  <a href="https://nodei.co/npm/gtfs/" rel="nofollow"><img src="https://nodei.co/npm/gtfs.png?downloads=true" alt="NPM" style="max-width: 100%;"></a>
</p>

<hr>

`node-GTFS` loads transit data in [GTFS format](https://developers.google.com/transit/) into a SQLite database and provides some methods to query for agencies, routes, stops, times, fares, calendars and other GTFS data. It also offers spatial queries to find nearby stops, routes and agencies and can convert stops and shapes to geoJSON format. Additionally, this library can export data from the SQLite database back into GTFS (csv) format.

The library also supports importing GTFS-Realtime data into the same database. In order to keep the realtime database fresh, it uses `SQLITE REPLACE` which makes it very effective.

You can use it as a [command-line tool](#command-line-examples) or as a [node.js module](#code-example).

This library has four parts: the [GTFS import script](#gtfs-import-script), [GTFS export script](#gtfs-export-script) and [GTFS-Realtime update script](#gtfsrealtime-update-script) and the [query methods](#query-methods)

## Breaking changes in Version 4

Version 4 of node-gtfs switched to using the better-sqlite3 library. This allowed all query methods to become synchronous and speeds up import and export.

- All query methods are now synchronous.

```js
// Version 3
const routes = await getRoutes();

// Version 4
const routes = getRoutes();
```

- `runRawQuery` has been removed. Use [Raw SQLite Query](#raw-sqlite-query) instead.
- `execRawQuery` has been removed. Use [Raw SQLite Query](#raw-sqlite-query) instead.
- `getDb` has been removed. Use `openDb` instead.

## Installation

To use this library as a command-line utility, install it globally [npm](https://npmjs.org):

    npm install gtfs -g

This will add the `gtfs-import` and `gtfs-export` scripts to your path.

If you are using this as a node module as part of an application, include it in your project's `package.json` file.

    npm install gtfs

## Quick Start

### Command-line examples

    gtfs-import --gtfsUrl http://www.bart.gov/dev/schedules/google_transit.zip

or

    gtfs-import --gtfsPath /path/to/your/gtfs.zip

or

    gtfs-import --gtfsPath /path/to/your/unzipped/gtfs

or

    gtfs-import --configPath /path/to/your/custom-config.json

    gtfs-export --configPath /path/to/your/custom-config.json

### Code example

```js
import { importGtfs } from 'gtfs';
import { readFile } from 'fs/promises';

const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

try {
  await importGtfs(config);
} catch (error) {
  console.error(error);
}
```

### Example Applications

<table>
  <tr>
    <td><img src="https://github.com/BlinkTagInc/gtfs-to-html/raw/master/www/static/img/gtfs-to-html-logo.svg" alt="GTFS-to-HTML" width="200"></td>
    <td><a href="https://gtfstohtml.com">GTFS-to-HTML</a> uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library and is used by over a dozen transit agencies to generate the timetables on their websites.</td>
  </tr>
  <tr>
    <td><img src="https://github.com/BlinkTagInc/gtfs-to-geojson/raw/master/docs/images/gtfs-to-geojson-logo.svg" alt="GTFS-to-geojson" width="200"></td>
    <td><a href="https://github.com/blinktaginc/gtfs-to-geojson">GTFS-to-geojson</a> creates geoJSON files for transit routes for use in mapping. It uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library.</td>
  </tr>
  <tr>
    <td><img src="https://github.com/BlinkTagInc/gtfs-to-chart/raw/master/docs/images/gtfs-to-chart-logo.svg" alt="GTFS-to-Chart" width="200"></td>
    <td><a href="https://github.com/blinktaginc/gtfs-to-chart">GTFS-to-chart</a> generates a stringline chart in D3 for all trips for a specific route using data from an agency's GTFS. It uses `node-gtfs` for downloading, importing and querying GTFS data.</td>
  </tr>
  <tr>
    <td><img src="https://github.com/BlinkTagInc/gtfs-tts/raw/main/docs/images/gtfs-tts-logo.svg" alt="GTFS-TTS" width="200"></td>
    <td><a href="https://github.com/blinktaginc/gtfs-tts">GTFS-Text-to-Speech</a> app tests GTFS stop name pronunciation for text-to-speech. It uses `node-gtfs` for loading stop names from GTFS data.</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/BlinkTagInc/transit-departures-widget/main/docs/images/transit-departures-widget-logo.svg" alt="Transit Departures Widget" width="200"></td>
    <td><a href="https://github.com/BlinkTagInc/transit-departures-widget">Transit Departures Widget</a> creates a realtime transit departures widget from GTFS and GTFS-Realtime data.</td>
  </tr>
</table>

## Command-Line Usage

The `gtfs-import` command-line utility will import GTFS into SQLite3.

The `gtfs-export` command-line utility will create GTFS from data previously imported into SQLite3.

### gtfs-import Command-Line options

`configPath`

Allows specifying a path to a configuration json file. By default, `node-gtfs` will look for a `config.json` file in the directory it is being run from. Using a config.json file allows you specify more options than CLI arguments alone - see below.

    gtfs-import --configPath /path/to/your/custom-config.json

`gtfsPath`

Specify a local path to GTFS, either zipped or unzipped.

    gtfs-import --gtfsPath /path/to/your/gtfs.zip

or

    gtfs-import --gtfsPath /path/to/your/unzipped/gtfs

`gtfsUrl`

Specify a URL to a zipped GTFS file.

    gtfs-import --gtfsUrl http://www.bart.gov/dev/schedules/google_transit.zip

## TypeScript Support

Basic TypeScript typings are included with this library. Please [open an issue](https://github.com/blinktaginc/node-gtfs/issues) if you find any inconsistencies between the declared types and underlying code.

## Configuration

Copy `config-sample.json` to `config.json` and then add your projects configuration to `config.json`.

    cp config-sample.json config.json

| option                                  | type    | description                                                                                                                            |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`agencies`](#agencies)                 | array   | An array of GTFS files to be imported, and which files to exclude.                                                                     |
| [`csvOptions`](#csvOptions)             | object  | Options passed to `csv-parse` for parsing GTFS CSV files. Optional.                                                                    |
| [`exportPath`](#exportPath)             | string  | A path to a directory to put exported GTFS files. Optional, defaults to `gtfs-export/<agency_name>`.                                   |
| [`ignoreDuplicates`](#ignoreduplicates) | boolean | Whether or not to ignore unique constraints on ids when importing GTFS, such as `trip_id`, `calendar_id`. Optional, defaults to false. |
| [`sqlitePath`](#sqlitePath)             | string  | A path to an SQLite database. Optional, defaults to using an in-memory database.                                                       |
| [`verbose`](#verbose)                   | boolean | Whether or not to print output to the console. Optional, defaults to true.                                                             |

### agencies

{Array} Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com).

#### agencies options

| option            | type   | description                                                                                                                        |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `url`             | string | The URL to a zipped GTFS file. Required if `path` not present.                                                                     |
| `path`            | string | A path to a zipped GTFS file or a directory of unzipped .txt files. Required if `url` is not present.                              |
| `headers`         | object | An object of HTTP headers in key:value format to use when fetching GTFS from the `url` specified. Optional.                        |
| `prefix`          | string | A prefix to be added to every ID field maintain uniqueness when importing multiple GTFS from multiple agencies. Optional.          |
| `exclude`         | array  | An array of GTFS file names (without `.txt`) to exclude when importing. Optional.                                                  |
| `realtimeUrls`    | array  | An array of GTFS-Realtime urls to import. Optional.                                                                                |
| `realtimeHeaders` | array  | An object of HTTP headers in key:value format to use when fetching GTFS-Realtime data from the `realtimeUrls` specified. Optional. |

- Specify a `url` to download GTFS:

```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip"
    }
  ]
}
```

- Specify a download URL with custom headers using the `headers` field:

```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "bearer 1234567890"
      }
    }
  ]
}
```

- Specify a `path` to a zipped GTFS file:

```json
{
  "agencies": [
    {
      "path": "/path/to/the/gtfs.zip"
    }
  ]
}
```

- Specify a `path` to an unzipped GTFS file:

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

- If you don't want all GTFS files to be imported, you can specify an array of files to `exclude`. This can save a lot of time for larger GTFS.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/",
      "exclude": ["shapes", "stops"]
    }
  ]
}
```

- Specify urls for GTFS-Realtime updates. `realtimeUrls` allows an array of GTFS-Realtime URLs. For example, a URL for trip updates, a URL for vehicle updates and a URL for service alerts. In addition, a `realtimeHeaders` parameter allows adding additional HTTP headers to the request.

```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip",
      "realtimeUrls": [
        "https://opendata.somewhere.com/gtfs-rt/VehicleUpdates.pb",
        "https://opendata.somewhere.com/gtfs-rt/TripUpdates.pb"
      ],
      "realtimeHeaders": {
        "Authorization": "bearer 1234567890"
      }
    }
  ]
}
```

- Specify multiple agencies to be imported into the same database

```json
{
  "agencies": [
    {
      "path": "/path/to/the/gtfs.zip"
    },
    {
      "path": "/path/to/the/othergtfs.zip"
    }
  ]
}
```

- When importing multiple agencies their IDs may overlap. Specify a `prefix` to be added to every ID field to maintain uniqueness.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/gtfs.zip",
      "prefix": "A"
    },
    {
      "path": "/path/to/the/othergtfs.zip",
      "prefix": 10000
    }
  ]
}
```

### csvOptions

{Object} Add options to be passed to [`csv-parse`](https://csv.js.org/parse/) with the key `csvOptions`. This is an optional parameter.

For instance, if you wanted to skip importing invalid lines in the GTFS file:

```json
    "csvOptions": {
      "skip_lines_with_error": true
    }
```

See [full list of options](https://csv.js.org/parse/options/).

### exportPath

{String} A path to a directory to put exported GTFS files. If the directory does not exist, it will be created. Used when running `gtfs-export` script or `exportGtfs()`. Optional, defaults to `gtfs-export/<agency_name>` where `<agency_name>` is a sanitized, [snake-cased](https://en.wikipedia.org/wiki/Snake_case) version of the first `agency_name` in `agency.txt`.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ],
  "exportPath": "~/path/to/export/gtfs"
}
```

### ignoreDuplicates

{Boolean} If you don't want node-GTFS to throw an error when it encounters a duplicate id on GTFS import. If `true`, it will skip importing duplicate records where unique constraints are violated, such as`trip_id`, `stop_id`, `calendar_id`. Useful if importing GTFS from multiple sources into one SQlite database that share routes or stops. Defaults to `false`.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ],
  "ignoreDuplicates": false
}
```

### sqlitePath

{String} A path to an SQLite database. Optional, defaults to using an in-memory database with a value of `:memory:`.

```json
    "sqlitePath": "/dev/sqlite/gtfs"
```

### verbose

{Boolean} If you don't want the import script to print any output to the console, you can set `verbose` to `false`. Defaults to `true`.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ],
  "verbose": false
}
```

If you want to route logs to a custom function, you can pass a function that takes a single `text` argument as `logFunction`. This can't be defined in `config.json` but instead passed in a config object to `importGtfs()`. For example:

```js
import { importGtfs } from 'gtfs';

const config = {
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: ['shapes'],
    },
  ],
  logFunction: function (text) {
    // Do something with the logs here, like save it or send it somewhere
    console.log(text);
  },
};

await importGtfs(config);
```

## `gtfs-import` Script

The `gtfs-import` script reads from a JSON configuration file and imports the GTFS files specified to a SQLite database. [Read more on setting up your configuration file](#configuration).

### Run the `gtfs-import` script from command-line

    gtfs-import

By default, it will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-import --configPath /path/to/your/custom-config.json

### Use `importGtfs` script in code

Use `importGtfs()` in your code to run an import of a GTFS file specified in a config.json file.

```js
import { importGtfs } from 'gtfs';
import { readFile } from 'fs/promises';

const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

await importGtfs(config);
```

Configuration can be a JSON object in your code

```js
import { importGtfs } from 'gtfs';

const config = {
  sqlitePath: '/dev/sqlite/gtfs',
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: ['shapes'],
    },
  ],
};

await importGtfs(config);
```

## `gtfsrealtime-update` Script

The `gtfsrealtime-update` script requests GTFS-Realtime data and importings into a SQLite database. [GTFS-Realtime data](https://gtfs.org/realtime/reference/) can compliment GTFS Static data. [Read more about GTFS-Realtime configuration](#configuration).

### Run the `gtfsrealtime-update` script from command-line

    gtfsrealtime-update

By default, it will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfsrealtime-update --configPath /path/to/your/custom-config.json

### Use `updateGtfsRealtime` script in code

Use `updateGtfsRealtime()` in your code to run an update of a GTFS-Realtime data specified in a config.json file.

```js
import { updateGtfsRealtime } from 'gtfs';
import { readFile } from 'fs/promises';

const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

await updateGtfsRealtime(config);
```

## `gtfs-export` Script

The `gtfs-export` script reads from a JSON configuration file and exports data in GTFS format from a SQLite database. [Read more on setting up your configuration file](#configuration).

This could be used to export a GTFS file from SQLite after changes have been made to the data in the database manually.

### Make sure to import GTFS data into SQLite first

Nothing will be exported if there is no data to export. See the [GTFS import script](#gtfs-import-script).

### Run the `gtfs-export` script from Command-line

    gtfs-export

By default, it will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-export --configPath /path/to/your/custom-config.json

### Command-Line options

#### Specify path to config JSON file

You can specify the path to a config file to be used by the export script.

    gtfs-export --configPath /path/to/your/custom-config.json

#### Show help

Show all command-line options

    gtfs-export --help

### Use `exportGtfs` script in code

Use `exportGtfs()` in your code to run an export of a GTFS file specified in a config.json file.

```js
import { exportGtfs } from 'gtfs';

const config = {
  sqlitePath: '/dev/sqlite/gtfs',
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: ['shapes'],
    },
  ],
};

await exportGtfs(config);
```

## Query Methods

This library includes many methods you can use in your project to query GTFS data. In addition to standard static GTFS, `node-gtfs` supports the following extensions to GTFS:

- [GTFS-Realtime](https://gtfs.org/realtime/) - Realtime alerts, vehicle positions and predictions
- [GTFS-Ride](https://gtfsride.org) - Passenger counts
- [Operational Data Standard (ODS)](https://docs.calitp.org/operational-data-standard/) - Deadheads and personnel info
- [GTFS-Timetables](https://gtfstohtml.com) - Information for creating human-readable timetables

There are also methods for retrieving stops and shapes in geoJSON format.

Most query methods accept three optional arguments: `query`, `fields`, `sortBy` and `options`.

For more advanced queries, you can use `advancedQuery` or raw SQL queries using query method from [better-sqlite3](#raw-sqlite-query).

### Database Setup

To use any of the query methods, first open the database using `openDb` before making any queries:

```js
import { openDb } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);
const db = openDb(config);
```

If you no longer need a database (especially if using an in-memory database) you can use `closeDb`:

```js
import { closeDb, openDb } from 'gtfs';
const db = openDb(config);

// Do some stuff here

// Close database connection when done.
closeDb(db);
```

### Examples

For example, to get a list of all routes with just `route_id`, `route_short_name` and `route_color` sorted by `route_short_name`:

```js
import { closeDb, openDb, getRoutes } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

const db = openDb(config);
const routes = getRoutes(
  {}, // No query filters
  ['route_id', 'route_short_name', 'route_color'], // Only return these fields
  [['route_short_name', 'ASC']], // Sort by this field and direction
  { db: db } // Options for the query. Can specify which database to use if more than one are open
);

closeDb(db);
```

To get a list of all trip_ids for a specific route:

```js
import { closeDb, openDb, getTrips } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

const db = openDb(config);
const trips = getTrips(
  {
    route_id: '123',
  },
  ['trip_id']
);

closeDb(db);
```

To get a few stops by specific stop_ids:

```js
import { closeDb, openDb, getStops } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));

const db = openDb(config);
const stops = getStops(
  {
    stop_id: [
      '123',
      '234'
      '345'
    ]
  }
);

closeDb(db);
```

### Static GTFS Files

#### getAgencies(query, fields, sortBy, options)

Returns an array of agencies that match query parameters. [Details on agency.txt](https://gtfs.org/schedule/reference/#agencytxt)

```js
import { getAgencies } from 'gtfs';

// Get all agencies
const agencies = getAgencies();

// Get a specific agency
const agencies = getAgencies({
  agency_id: 'caltrain',
});
```

#### getAreas(query, fields, sortBy, options)

Returns an array of areas that match query parameters. [Details on areas.txt](https://gtfs.org/schedule/reference/#areastxt)

```js
import { getAreas } from 'gtfs';

// Get all areas
const areas = getAreas();

// Get a specific area
const areas = getAreas({
  area_id: 'area1',
});
```

#### getAttributions(query, fields, sortBy, options)

Returns an array of attributions that match query parameters. [Details on attributions.txt](https://gtfs.org/schedule/reference/#attributionstxt)

```js
import { getAttributions } from 'gtfs';

// Get all attributions
const attributions = getAttributions();

// Get a specific attribution
const attributions = getAttributions({
  attribution_id: '123',
});
```

#### getRoutes(query, fields, sortBy, options)

Returns an array of routes that match query parameters. [Details on routes.txt](https://gtfs.org/schedule/reference/#routestxt)

```js
import { getRoutes } from 'gtfs';

// Get all routes, sorted by route_short_name
const routes = getRoutes({}, [], [['route_short_name', 'ASC']]);

// Get a specific route
const routes = getRoutes({
  route_id: 'Lo-16APR',
});

/*
 * `getRoutes` allows passing a `stop_id` as part of the query. This will
 * query stoptimes and trips to find all routes that serve that `stop_id`.
 */
const routes = getRoutes(
  {
    stop_id: '70011',
  },
  [],
  [['stop_name', 'ASC']]
);
```

#### getStops(query, fields, sortBy, options)

Returns an array of stops that match query parameters. [Details on stops.txt](https://gtfs.org/schedule/reference/#stopstxt)

```js
import { getStops } from 'gtfs';

// Get all stops
const stops = getStops();

// Get a specific stop by stop_id
const stops = getStops({
  stop_id: '70011',
});

/*
 * `getStops` allows passing a `route_id` in the query and it will
 * query trips and stoptimes to find all stops served by that `route_id`.
 */
const stops = getStops({
  route_id: 'Lo-16APR',
});

/*
 * `getStops` allows passing a `trip_id` in the query and it will query
 * stoptimes to find all stops on that `trip_id`.
 */
const stops = getStops({
  trip_id: '37a',
});

/*
 * `getStops` allows passing a `shape_id` in the query and it will query
 * trips and stoptimes to find all stops that use that `shape_id`.
 */
const stops = getStops({
  shape_id: 'cal_sf_tam',
});
```

#### getStopsAsGeoJSON(query, options)

Returns geoJSON object of stops that match query parameters. Stops will include all properties of each stop from stops.txt and stop_attributes.txt if present. All valid queries for `getStops()` work for `getStopsAsGeoJSON()`.

```js
import { getStopsAsGeoJSON } from 'gtfs';

// Get all stops for an agency as geoJSON
const stopsGeojson = getStopsAsGeoJSON();

// Get all stops for a specific route as geoJSON
const stopsGeojson = getStopsAsGeoJSON({
  route_id: 'Lo-16APR',
});
```

#### getStoptimes(query, fields, sortBy, options)

Returns an array of stop_times that match query parameters. [Details on stop_times.txt](https://gtfs.org/schedule/reference/#stop_timestxt)

```js
import { getStoptimes } from 'gtfs';

// Get all stoptimes
const stoptimes = getStoptimes();

// Get all stoptimes for a specific stop
const stoptimes = getStoptimes({
  stop_id: '70011',
});

// Get all stoptimes for a specific trip, sorted by stop_sequence
const stoptimes = getStoptimes(
  {
    trip_id: '37a',
  },
  [],
  [['stop_sequence', 'ASC']]
);

// Get all stoptimes for a specific stop and service_id
const stoptimes = getStoptimes({
  stop_id: '70011',
  service_id: 'CT-16APR-Caltrain-Weekday-01',
});
```

#### getTrips(query, fields, sortBy, options)

Returns an array of trips that match query parameters. [Details on trips.txt](https://gtfs.org/schedule/reference/#tripstxt)

```js
import { getTrips } from 'gtfs';

// Get all trips
const trips = getTrips();

// Get trips for a specific route and direction
const trips = getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0
});

// Get trips for direction '' or null
const trips = getTrips({
  route_id: 'Lo-16APR',
  direction_id: null
});

// Get trips for a specific route and direction limited by a service_id
const trips = getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0,
  service_id: '
});
```

#### getShapes(query, fields, sortBy, options)

Returns an array of shapes that match query parameters. [Details on shapes.txt](https://gtfs.org/schedule/reference/#shapestxt)

```js
import { getShapes } from 'gtfs';

// Get all shapes for an agency
const shapes = getShapes();

/*
 * `getShapes` allows passing a `route_id` in the query and it will query
 * trips to find all shapes served by that `route_id`.
 */
const shapes = getShapes({
  route_id: 'Lo-16APR',
});

/*
 * `getShapes` allows passing a `trip_id` in the query and it will query
 * trips to find all shapes served by that `trip_id`.
 */
const shapes = getShapes({
  trip_id: '37a',
});

/*
 * `getShapes` allows passing a `service_id` in the query and it will query
 * trips to find all shapes served by that `service_id`.
 */
const shapes = getShapes({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});
```

#### getShapesAsGeoJSON(query, options)

Returns a geoJSON object of shapes that match query parameters. Shapes will include all properties of each route from routes.txt and route_attributes.txt if present. All valid queries for `getShapes()` work for `getShapesAsGeoJSON()`.

```js
import { getShapesAsGeoJSON } from 'gtfs';

// Get geoJSON of all routes in an agency
const shapesGeojson = getShapesAsGeoJSON();

// Get geoJSON of shapes for a specific route
const shapesGeojson = getShapesAsGeoJSON({
  route_id: 'Lo-16APR',
});

// Get geoJSON of shapes for a specific trip
const shapesGeojson = getShapesAsGeoJSON({
  trip_id: '37a',
});

// Get geoJSON of shapes for a specific `service_id`
const shapesGeojson = getShapesAsGeoJSON({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});

// Get geoJSON of shapes for a specific `shape_id`
const shapesGeojson = getShapesAsGeoJSON({
  shape_id: 'cal_sf_tam',
});
```

#### getCalendars(query, fields, sortBy, options)

Returns an array of calendars that match query parameters. [Details on calendar.txt](https://gtfs.org/schedule/reference/#calendartxt)

```js
import { getCalendars } from 'gtfs';

// Get all calendars for an agency
const calendars = getCalendars();

// Get calendars for a specific `service_id`
const calendars = getCalendars({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});
```

#### getCalendarDates(query, fields, sortBy, options)

Returns an array of calendar_dates that match query parameters. [Details on calendar_dates.txt](https://gtfs.org/schedule/reference/#calendar_datestxt)

```js
import { getCalendarDates } from 'gtfs';

// Get all calendar_dates for an agency
const calendarDates = getCalendarDates();

// Get calendar_dates for a specific `service_id`
const calendarDates = getCalendarDates({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});
```

#### getFareAttributes(query, fields, sortBy, options)

Returns an array of fare_attributes that match query parameters. [Details on fare_attributes.txt](https://gtfs.org/schedule/reference/#fare_attributestxt)

```js
import { getFareAttributes } from 'gtfs';

// Get all `fare_attributes` for an agency
const fareAttributes = getFareAttributes();

// Get `fare_attributes` for a specific `fare_id`
const fareAttributes = getFareAttributes({
  fare_id: '123',
});
```

#### getFareLegRules(query, fields, sortBy, options)

Returns an array of fare_leg_rules that match query parameters. [Details on fare_leg_rules.txt](https://gtfs.org/schedule/reference/#fare_leg_rulestxt)

```js
import { getFareLegRules } from 'gtfs';

// Get all fare leg rules
const fareLegRules = getFareLegRules();

// Get fare leg rules for a specific fare product
const fareLegRules = getFareLegRules({
  fare_product_id: 'product1',
});
```

#### getFareProducts(query, fields, sortBy, options)

Returns an array of fare_products that match query parameters. [Details on fare_products.txt](https://gtfs.org/schedule/reference/#fare_productstxt)

```js
import { getFareProducts } from 'gtfs';

// Get all fare products
const fareProducts = getFareProducts();

// Get a specific fare product
const fareProducts = getFareProducts({
  fare_product_id: 'product1',
});
```

#### getFareRules(query, fields, sortBy, options)

Returns an array of fare_rules that match query parameters. [Details on fare_rules.txt](https://gtfs.org/schedule/reference/#fare_rulestxt)

```js
import { getFareRules } from 'gtfs';

// Get all `fare_rules` for an agency
const fareRules = getFareRules();

// Get fare_rules for a specific route
const fareRules = getFareRules({
  route_id: 'Lo-16APR',
});
```

#### getFareTransferRules(query, fields, sortBy, options)

Returns an array of fare_transfer_rules that match query parameters. [Details on fare_transfer_rules.txt](https://gtfs.org/schedule/reference/#fare_transfer_rulestxt)

```js
import { getFareTransferRules } from 'gtfs';

// Get all fare transfer rules
const fareTransferRules = getFareTransferRules();

// Get a all fare transfer rules for a specific fare product
const fareTransferRules = getFareTransferRules({
  fare_product_id: 'product1',
});
```

#### getFeedInfo(query, fields, sortBy, options)

Returns an array of feed_info that match query parameters. [Details on feed_info.txt](https://gtfs.org/schedule/reference/#feed_infotxt)

```js
import { getFeedInfo } from 'gtfs';

// Get feed_info
const feedInfo = getFeedInfo();
```

#### getFrequencies(query, fields, sortBy, options)

Returns an array of frequencies that match query parameters. [Details on frequencies.txt](https://gtfs.org/schedule/reference/#frequenciestxt)

```js
import { getFrequencies } from 'gtfs';

// Get all frequencies
const frequencies = getFrequencies();

// Get frequencies for a specific trip
const frequencies = getFrequencies({
  trip_id: '1234',
});
```

#### getLevels(query, fields, sortBy, options)

Returns an array of levels that match query parameters. [Details on levels.txt](https://gtfs.org/schedule/reference/#levelstxt)

```js
import { getLevels } from 'gtfs';

// Get all levels
const levels = getLevels();
```

#### getPathways(query, fields, sortBy, options)

Returns an array of pathways that match query parameters. [Details on pathways.txt](https://gtfs.org/schedule/reference/#pathwaystxt)

```js
import { getPathways } from 'gtfs';

// Get all pathways
const pathways = getPathways();
```

#### getTransfers(query, fields, sortBy, options)

Returns an array of transfers that match query parameters. [Details on transfers.txt](https://gtfs.org/schedule/reference/#transferstxt)

```js
import { getTransfers } from 'gtfs';

// Get all transfers
const transfers = getTransfers();

// Get transfers for a specific stop
const transfers = getTransfers({
  from_stop_id: '1234',
});
```

#### getTranslations(query, fields, sortBy, options)

Returns an array of translations that match query parameters. [Details on translations.txt](https://gtfs.org/schedule/reference/#translationstxt)

```js
import { getTranslations } from 'gtfs';

// Get all translations
const translations = getTranslations();
```

#### getStopAreas(query, fields, sortBy, options)

Returns an array of stop_areas that match query parameters. [Details on stop_areas.txt](https://gtfs.org/schedule/reference/#stop_areastxt)

```js
import { getStopAreas } from 'gtfs';

// Get all stop areas
const stopAreas = getStopAreas();
```

### GTFS-Timetables files

#### getTimetables(query, fields, sortBy, options)

Returns an array of timetables that match query parameters. This is for the non-standard `timetables.txt` file used in GTFS-to-HTML. [Details on timetables.txt](https://gtfstohtml.com/docs/timetables)

```js
import { getTimetables } from 'gtfs';

// Get all timetables for an agency
const timetables = getTimetables();

// Get a specific timetable
const timetables = getTimetables({
  timetable_id: '1',
});
```

#### getTimetableStopOrders(query, fields, sortBy, options)

Returns an array of timetable_stop_orders that match query parameters. This is for the non-standard `timetable_stop_order.txt` file used in GTFS-to-HTML. [Details on timetable_stop_order.txt](https://gtfstohtml.com/docs/timetable-stop-order)

```js
import { getTimetableStopOrders } from 'gtfs';

// Get all timetable_stop_orders
const timetableStopOrders = getTimetableStopOrders();

// Get timetable_stop_orders for a specific timetable
const timetableStopOrders = getTimetableStopOrders({
  timetable_id: '1',
});
```

#### getTimetablePages(query, fields, sortBy, options)

Returns an array of timetable_pages that match query parameters. This is for the non-standard `timetable_pages.txt` file used in GTFS-to-HTML. [Details on timetable_pages.txt](https://gtfstohtml.com/docs/timetable-pages)

```js
import { getTimetablePages } from 'gtfs';

// Get all timetable_pages for an agency
const timetablePages = getTimetablePages();

// Get a specific timetable_page
const timetablePages = getTimetablePages({
  timetable_page_id: '2',
});
```

#### getTimetableNotes(query, fields, sortBy, options)

Returns an array of timetable_notes that match query parameters. This is for the non-standard `timetable_notes.txt` file used in GTFS-to-HTML. [Details on timetable_notes.txt](https://gtfstohtml.com/docs/timetable-notes)

```js
import { getTimetableNotes } from 'gtfs';

// Get all timetable_notes for an agency
const timetableNotes = getTimetableNotes();

// Get a specific timetable_note
const timetableNotes = getTimetableNotes({
  note_id: '1',
});
```

#### getTimetableNotesReferences(query, fields, sortBy, options)

Returns an array of timetable_notes_references that match query parameters. This is for the non-standard `timetable_notes_references.txt` file used in GTFS-to-HTML. [Details on timetable_notes_references.txt](https://gtfstohtml.com/docs/timetable-notes-references)

```js
import { getTimetableNotesReferences } from 'gtfs';

// Get all timetable_notes_references for an agency
const timetableNotesReferences = getTimetableNotesReferences();

// Get all timetable_notes_references for a specific timetable
const timetableNotesReferences = getTimetableNotesReferences({
  timetable_id: '4',
});
```

### GTFS-Realtime

In order to use GTFS-Realtime query methods, you must first configure GTFS Realtime import in node-gtfs

#### getServiceAlerts(query, fields, sortBy, options)

Returns an array of GTFS Realtime service alerts that match query parameters. [Details on Service Alerts](https://gtfs.org/realtime/feed-entities/service-alerts/)

```js
import { getServiceAlerts } from 'gtfs';

// Get service alerts
const serviceAlerts = getServiceAlerts();
```

#### getTripUpdates(query, fields, sortBy, options)

Returns an array of GTFS Realtime trip updates that match query parameters. [Details on Trip Updates](https://gtfs.org/realtime/feed-entities/trip-updates/)

```js
import { getTripUpdates } from 'gtfs';

// Get all trip updates
const tripUpdates = getTripUpdates();
```

#### getStopTimesUpdates(query, fields, sortBy, options)

Returns an array of GTFS Realtime stop time updates that match query parameters. [Details on Stop Time Updates](https://gtfs.org/realtime/feed-entities/trip-updates/#stoptimeupdate)

```js
import { getStopTimesUpdates } from 'gtfs';

// Get all stop times updates
const stopTimesUpdates = getStopTimesUpdates();
```

#### getVehiclePositions(query, fields, sortBy, options)

Returns an array of GTFS Realtime vehicle positions that match query parameters. [Details on Vehicle Positions](https://gtfs.org/realtime/feed-entities/vehicle-positions/)

```js
import { getVehiclePositions } from 'gtfs';

// Get all vehicle position data
const vehiclePositions = getVehiclePositions();
```

### GTFS+ Files

#### getCalendarAttributes(query, fields, sortBy, options)

Returns an array of calendar_attributes that match query parameters.

```js
import { getCalendarAttributes } from 'gtfs';

// Get all calendar attributes
const calendarAttributes = getCalendarAttributes();

// Get calendar attributes for specific service
const calendarAttributes = getCalendarAttributes({
  service_id: '1234',
});
```

#### getDirections(query, fields, sortBy, options)

Returns an array of directions that match query parameters.

```js
import { getDirections } from 'gtfs';

// Get all directions
const directions = getDirections();

// Get directions for a specific route
const directions = getDirections({
  route_id: '1234',
});

// Get directions for a specific route and direction
const directions = getDirections({
  route_id: '1234',
  direction_id: 1,
});
```

#### getRouteAttributes(query, fields, sortBy, options)

Returns an array of route_attributes that match query parameters.

```js
import { getRouteAttributes } from 'gtfs';

// Get all route attributes
const routeAttributes = getRouteAttributes();

// Get route attributes for specific route
const routeAttributes = getRouteAttributes({
  route_id: '1234',
});
```

#### getStopAttributes(query, fields, sortBy, options)

Returns an array of stop_attributes that match query parameters.

```js
import { getStopAttributes } from 'gtfs';

// Get all stop attributes
const stopAttributes = getStopAttributes();

// Get stop attributes for specific stop
const stopAttributes = getStopAttributes({
  stop_id: '1234',
});
```

### GTFS-Ride Files

See full [documentation of GTFS Ride](https://gtfsride.org).

#### getBoardAlights(query, fields, sortBy, options)

Returns an array of board_alight that match query parameters. [Details on board_alight.txt](http://gtfsride.org/specification#board_alighttxt)

```js
import { getBoardAlights } from 'gtfs';

// Get all board_alight
const boardAlights = getBoardAlights();

// Get board_alight for a specific trip
const boardAlights = getBoardAlights({
  trip_id: '123',
});
```

#### getRideFeedInfos(query, fields, sortBy, options)

Returns an array of ride_feed_info that match query parameters. [Details on ride_feed_info.txt](http://gtfsride.org/specification#ride_feed_infotxt)

```js
import { getRideFeedInfos } from 'gtfs';

// Get all ride_feed_info
const rideFeedInfos = getRideFeedInfos();
```

#### getRiderTrips(query, fields, sortBy, options)

Returns an array of rider_trip that match query parameters. [Details on rider_trip.txt](http://gtfsride.org/specification#rider_triptxt)

```js
import { getRiderTrips } from 'gtfs';

// Get all rider_trip
const riderTrips = getRiderTrips();

// Get rider_trip for a specific trip
const riderTrips = getRiderTrips({
  trip_id: '123',
});
```

#### getRiderships(query, fields, sortBy, options)

Returns an array of ridership that match query parameters. [Details on ridership.txt](http://gtfsride.org/specification#ridershiptxt)

```js
import { getRiderships } from 'gtfs';

// Get all ridership
const riderships = getRiderships();

// Get ridership for a specific route
const riderships = getRiderships({
  route_id: '123',
});
```

#### getTripCapacities(query, fields, sortBy, options)

Returns an array of trip_capacity that match query parameters. [Details on trip_capacity.txt](http://gtfsride.org/specification#trip_capacitytxt)

```js
import { getTripCapacities } from 'gtfs';

// Get all trip_capacity
const tripCapacities = getTripCapacities();

// Get trip_capacity for a specific trip
const tripCapacities = getTripCapacities({
  trip_id: '123',
});
```

### Operational Data Standard (ODS) Files

#### getDeadheads(query, fields, sortBy, options)

Returns an array of deadheads that match query parameters. [Details on deadheads.txt](https://docs.calitp.org/operational-data-standard/spec/#deadheadstxt)

```js
import { getDeadheads } from 'gtfs';

// Get all deadheads
const deadheads = getDeadheads();

// Get deadheads for a specific block
const deadheads = getDeadheads({
  block_id: '123',
});
```

#### getDeadheadTimes(query, fields, sortBy, options)

Returns an array of deadhead_times that match query parameters. [Details on deadhead_times.txt](https://docs.calitp.org/operational-data-standard/spec/#deadhead_timestxt)

```js
import { getDeadheadTimes } from 'gtfs';

// Get all deadhead_times
const deadheadTimes = getDeadheadTimes();

// Get deadhead_times for a specific deadhead
const deadheadTimes = getDeadheadTimes({
  deadhead_id: '123',
});
```

#### getOpsLocations(query, fields, sortBy, options)

Returns an array of ops_locations that match query parameters. [Details on ops_locations.txt](https://docs.calitp.org/operational-data-standard/spec/#ops_locationstxt)

```js
import { getOpsLocations } from 'gtfs';

// Get all ops_locations
const opsLocations = getOpsLocations();

// Get a specific ops_locations
const opsLocations = getOpsLocations({
  ops_location_id: '123',
});
```

#### getRunsPieces(query, fields, sortBy, options)

Returns an array of runs_pieces that match query parameters. [Details on runs_pieces.txt](https://docs.calitp.org/operational-data-standard/spec/#runs_piecestxt)

```js
import { getRunsPieces } from 'gtfs';

// Get all runs_pieces
const runsPieces = getRunsPieces();
```

#### getRunEvents(query, fields, sortBy, options)

Returns an array of run_events that match query parameters. [Details on run_events.txt](https://docs.calitp.org/operational-data-standard/spec/#run_eventstxt)

```js
import { getRunEvents } from 'gtfs';

// Get all run_events
const runEvents = runEvents();

// Get a run_events for a specific piece
const runEvents = runEvents({
  piece_id: '123',
});
```

### Other Non-standard GTFS Files

#### getTripsDatedVehicleJourneys(query, fields, sortBy, options)

Returns an array of trips_dated_vehicle_journey that match query parameters. This is for the non-standard `trips_dated_vehicle_journey.txt` file. [Details on trips_dated_vehicle_journey.txt](https://www.trafiklab.se/api/trafiklab-apis/gtfs-regional/extra-files/)

```js
import { getTripsDatedVehicleJourneys } from 'gtfs';

// Get all trips_dated_vehicle_journey
const tripsDatedVehicleJourneys = getTripsDatedVehicleJourneys();
```

### Advanced Query Methods

#### advancedQuery(table, advancedQueryOptions)

Queries the database with support for table joins and custom tables and returns an array of data.

```js
import { advancedQuery } from 'gtfs';

// Example `advancedQuery` joining stop_times with trips.
const advancedQueryOptions = {
  query: {
    'stop_times.trip_id': tripId,
  },
  fields: ['stop_times.trip_id', 'arrival_time'],
  join: [
    {
      type: 'INNER',
      table: 'trips',
      on: 'stop_times.trip_id=trips.trip_id',
    },
  ],
};

const stoptimes = advancedQuery('stop_times', advancedQueryOptions);
```

#### Raw SQLite Query

Use the `openDb` function to get the db object, and then use any query method from [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) to query GTFS data.

```js
import { openDb } from 'gtfs';
const db = openDb(config);

// Get a specific trip
const trip = db.prepare('SELECT * FROM trips WHERE trip_id = ?').get('123');

// Get all stops
const stops = db.prepare('SELECT * from stops').all();

// Get all calendar_ids for specific date
const calendarIds = db
  .prepare(
    'SELECT service_id from calendar WHERE start_date <= $date AND end_date >= $date'
  )
  .all({ date: 20150101 });

// Find all stops for route_id=18 by joining tables
const stopIds = db
  .prepare(
    'SELECT DISTINCT stops.stop_id from stops INNER JOIN stop_times ON stops.stop_id = stop_times.stop_id INNER JOIN trips on trips.trip_id = stop_times.trip_id WHERE trips.route_id = ?'
  )
  .all('18');

// Execute raw SQL
const sql = "DELETE FROM trips where trip_id = '329'";
db.exec(sql);
```

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/node-gtfs/issues).

### Tests

To run tests:

    npm test

To run a specific test:

    NODE_ENV=test mocha ./test/mocha/gtfs.get-stoptimes.js

### Linting

    npm run lint
