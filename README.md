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
  <a href="https://github.com/BlinkTagInc/node-gtfs/actions?query=workflow%3A%22Node+CI%22"><img src="https://img.shields.io/github/workflow/status/BlinkTagInc/node-gtfs/Node%20CI.svg" alt="CircleCI" style="max-width: 100%;"></a>
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

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs -g

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

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

importGtfs(config)
  .then(() => {
    console.log('Import Successful');
  })
  .catch((err) => {
    console.error(err);
  });
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

| option                      | type    | description                                                                                          |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| [`agencies`](#agencies)     | array   | An array of GTFS files to be imported.                                                               |
| [`csvOptions`](#csvOptions) | object  | Options passed to `csv-parse` for parsing GTFS CSV files. Optional.                                  |
| [`exportPath`](#exportPath) | string  | A path to a directory to put exported GTFS files. Optional, defaults to `gtfs-export/<agency_name>`. |
| [`sqlitePath`](#sqlitePath) | string  | A path to an SQLite database. Optional, defaults to using an in-memory database.                     |
| [`verbose`](#verbose)       | boolean | Whether or not to print output to the console. Optional, defaults to true.                           |

### agencies

{Array} Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com). You can use the
URL from the agency's website or you can use a URL generated from the transitfeeds.com
API along with your API token.

- Specify a download URL:

```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip"
    }
  ]
}
```

- Specify a download URL with custom headers:

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

- Specify a path to a zipped GTFS file:

```json
{
  "agencies": [
    {
      "path": "/path/to/the/gtfs.zip"
    }
  ]
}
```

- Specify a path to an unzipped GTFS file:

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

- Exclude files - if you don't want all GTFS files to be imported, you can specify an array of files to exclude.

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

importGtfs(config);
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

importGtfs(config)
  .then(() => {
    console.log('Import Successful');
  })
  .catch((err) => {
    console.error(err);
  });
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

importGtfs(config)
  .then(() => {
    console.log('Import Successful');
  })
  .catch((err) => {
    console.error(err);
  });
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

updateGtfsRealtime(config)
  .then(() => {
    console.log('Update Successful');
  })
  .catch((err) => {
    console.error(err);
  });
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

exportGtfs(config)
  .then(() => {
    console.log('Export Successful');
  })
  .catch((err) => {
    console.error(err);
  });
```

## Query Methods

This library includes many methods you can use in your project to query GTFS data. These methods return promises.

Most methods accept three optional arguments: `query`, `fields` and `sortBy`.

More advanced methods include `advancedQuery`, `runRawQuery` and `execRawQuery`.

#### Query

For example, to get a list of all routes with just `route_id`, `route_short_name` and `route_color` sorted by `route_short_name`:

```js
import { openDb, getRoutes } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

const db = await openDb(config);
const routes = await getRoutes(
  {},
  ['route_id', 'route_short_name', 'route_color'],
  [['route_short_name', 'ASC']]
);
```

To get a list of all trip_ids for a specific route:

```js
import { openDb, getTrips } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(new URL('./config.json', import.meta.url))
);

const db = await openDb(config);
const trips = await getTrips(
  {
    route_id: '123',
  },
  ['trip_id']
);
```

To get a few stops by specific stop_ids:

```js
import { openDb, getStops } from 'gtfs';
import { readFile } from 'fs/promises';
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));

const db = await openDb(config);
const stops = await getStops(
  {
    stop_id: [
      '123',
      '234'
      '345'
    ]
  }
);
```

### Setup

Include this library.

```js
import { openDb } from 'gtfs';
```

Open database before making any queries

```js
const db = await openDb(config);
```

### getAgencies(query, fields, sortBy)

Queries agencies and returns a promise. The result of the promise is an array of agencies.

```js
import { getAgencies } from 'gtfs';

// Get all agencies
getAgencies();

// Get a specific agency
getAgencies({
  agency_id: 'caltrain',
});
```

### getAttributions(query, fields, sortBy)

Queries attributions and returns a promise. The result of the promise is an array of attributions.

```js
import { getAttributions } from 'gtfs';

// Get all attributions
getAttributions();

// Get a specific attribution
getAttributions({
  attribution_id: '123',
});
```

### getRoutes(query, fields, sortBy)

Queries routes and returns a promise. The result of the promise is an array of routes.

```js
import { getRoutes } from 'gtfs';

// Get all routes, sorted by route_short_name
getRoutes({}, [], [['route_short_name', 'ASC']]);

// Get a specific route
getRoutes({
  route_id: 'Lo-16APR',
});
```

`getRoutes` allows passing a `stop_id` in the query and it will query stoptimes and trips to find all routes that serve that `stop_id`.

```js
import { getRoutes } from 'gtfs';

// Get routes that serve a specific stop, sorted by `stop_name`.
getRoutes(
  {
    stop_id: '70011',
  },
  [],
  [['stop_name', 'ASC']]
);
```

### getStops(query, fields, sortBy)

Queries stops and returns a promise. The result of the promise is an array of stops.

```js
import { getStops } from 'gtfs';

// Get all stops
getStops();

// Get a specific stop by stop_id
getStops({
  stop_id: '70011',
});
```

`getStops` allows passing a `route_id` in the query and it will query trips and stoptimes to find all stops served by that `route_id`.

```js
import { getStops } from 'gtfs';

// Get all stops for a specific route
getStops({
  route_id: 'Lo-16APR',
});
```

`getStops` allows passing a `trip_id` in the query and it will query stoptimes to find all stops on that `trip_id`.

```js
import { getStops } from 'gtfs';

// Get all stops for a specific trip
getStops({
  trip_id: '37a',
});
```

`getStops` allows passing a `shape_id` in the query and it will query trips and stoptimes to find all stops that use that `shape_id`.

```js
import { getStops } from 'gtfs';

// Get all stops for a specific trip
getStops({
  shape_id: 'cal_sf_tam',
});
```

### getStopsAsGeoJSON(query)

Queries stops and returns a promise. The result of the promise is an geoJSON object of stops. All valid queries for `getStops()` work for `getStopsAsGeoJSON()`.

```js
import { getStopsAsGeoJSON } from 'gtfs';

// Get all stops for an agency as geoJSON
getStopsAsGeoJSON();

// Get all stops for a specific route as geoJSON
getStopsAsGeoJSON({
  route_id: 'Lo-16APR',
});
```

### getStoptimes(query, fields, sortBy)

Queries `stop_times` and returns a promise. The result of the promise is an array of `stop_times`.

```js
import { getStoptimes } from 'gtfs';

// Get all stoptimes
getStoptimes();

// Get all stoptimes for a specific stop
getStoptimes({
  stop_id: '70011',
});

// Get all stoptimes for a specific trip, sorted by stop_sequence
getStoptimes(
  {
    trip_id: '37a',
  },
  [],
  [['stop_sequence', 'ASC']]
);

// Get all stoptimes for a specific stop and service_id
getStoptimes({
  stop_id: '70011',
  service_id: 'CT-16APR-Caltrain-Weekday-01',
});
```

### getTrips(query, fields, sortBy)

Queries trips and returns a promise. The result of the promise is an array of trips.

```js
import { getTrips } from 'gtfs';

// Get all trips
getTrips();

// Get trips for a specific route and direction
getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0
});

// Get trips for direction '' or null
getTrips({
  route_id: 'Lo-16APR',
  direction_id: null
});

// Get trips for a specific route and direction limited by a service_id
getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0,
  service_id: '
});
```

### getShapes(query, fields, sortBy)

Queries shapes and returns a promise. The result of the promise is an array of shapes.

```js
import { getShapes } from 'gtfs';

// Get all shapes for an agency
getShapes();
```

`getShapes` allows passing a `route_id` in the query and it will query trips to find all shapes served by that `route_id`.

```js
import { getShapes } from 'gtfs';

// Get all shapes for a specific route and direction
getShapes({
  route_id: 'Lo-16APR',
});
```

`getShapes` allows passing a `trip_id` in the query and it will query trips to find all shapes served by that `trip_id`.

```js
import { getShapes } from 'gtfs';

// Get all shapes for a specific trip_id
getShapes({
  trip_id: '37a',
});
```

`getShapes` allows passing a `service_id` in the query and it will query trips to find all shapes served by that `service_id`.

```js
import { getShapes } from 'gtfs';

// Get all shapes for a specific service_id
.etShapes({
  service_id: 'CT-16APR-Caltrain-Sunday-02'
});
```

### getShapesAsGeoJSON(query)

Queries shapes and returns a promise. The result of the promise is an geoJSON object of shapes. All valid queries for `getShapes()` work for `getShapesAsGeoJSON()`.

Returns geoJSON of shapes.

```js
import { getShapesAsGeoJSON } from 'gtfs';

// Get geoJSON of all routes in an agency
getShapesAsGeoJSON();

// Get geoJSON of shapes for a specific route
getShapesAsGeoJSON({
  route_id: 'Lo-16APR',
});

// Get geoJSON of shapes for a specific trip
getShapesAsGeoJSON({
  trip_id: '37a',
});

// Get geoJSON of shapes for a specific `service_id`
getShapesAsGeoJSON({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});

// Get geoJSON of shapes for a specific `shape_id`
getShapesAsGeoJSON({
  shape_id: 'cal_sf_tam',
});
```

### getCalendars(query, fields, sortBy)

Queries calendars and returns a promise. The result of the promise is an array of calendars.

```js
import { getCalendars } from 'gtfs';

// Get all calendars for an agency
getCalendars();

// Get calendars for a specific `service_id`
getCalendars({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});
```

### getCalendarDates(query, fields, sortBy)

Queries calendar_dates and returns a promise. The result of the promise is an array of calendar_dates.

```js
import { getCalendarDates } from 'gtfs';

// Get all calendar_dates for an agency
getCalendarDates();

// Get calendar_dates for a specific `service_id`
getCalendarDates({
  service_id: 'CT-16APR-Caltrain-Sunday-02',
});
```

### getFareAttributes(query, fields, sortBy)

Queries fare_attributes and returns a promise. The result of the promise is an array of fare_attributes.

```js
import { getFareAttributes } from 'gtfs';

// Get all `fare_attributes` for an agency
getFareAttributes();

// Get `fare_attributes` for a specific `fare_id`
getFareAttributes({
  fare_id: '123',
});
```

### getFareRules(query, fields, sortBy)

Queries fare_rules and returns a promise. The result of the promise is an array of fare_rules.

```js
import { getFareRules } from 'gtfs';

// Get all `fare_rules` for an agency
getFareRules();

// Get fare_rules for a specific route
getFareRules({
  route_id: 'Lo-16APR',
});
```

### getFeedInfo(query, fields, sortBy)

Queries feed_info and returns a promise. The result of the promise is an array of feed_infos.

```js
import { getFeedInfo } from 'gtfs';

// Get feed_info
getFeedInfo();
```

### getFrequencies(query, fields, sortBy)

Queries frequencies and returns a promise. The result of the promise is an array of frequencies.

```js
import { getFrequencies } from 'gtfs';

// Get all frequencies
getFrequencies();

// Get frequencies for a specific trip
getFrequencies({
  trip_id: '1234',
});
```

### getLevels(query, fields, sortBy)

Queries levels and returns a promise. The result of the promise is an array of levels.

```js
import { getLevels } from 'gtfs';

// Get levels
getLevels();
```

### getPathways(query, fields, sortBy)

Queries pathways and returns a promise. The result of the promise is an array of pathways.

```js
import { getPathways } from 'gtfs';

// Get pathways
getPathways();
```

### getTransfers(query, fields, sortBy)

Queries transfers and returns a promise. The result of the promise is an array of transfers.

```js
import { getTransfers } from 'gtfs';

// Get all transfers
getTransfers();

// Get transfers for a specific stop
getTransfers({
  from_stop_id: '1234',
});
```

### getTranslations(query, fields, sortBy)

Queries translations and returns a promise. The result of the promise is an array of translations.

```js
import { getTranslations } from 'gtfs';

// Get translations
getTranslations();
```

### getDirections(query, fields, sortBy)

Queries directions and returns a promise. The result of the promise is an array of directions. These are from the non-standard `directions.txt` file. See [documentation and examples of this file](https://trilliumtransit.com/gtfs/reference/#directions).

```js
import { getDirections } from 'gtfs';

// Get all directions
getDirections();

// Get directions for a specific route
getDirections({
  route_id: '1234',
});

// Get directions for a specific route and direction
getDirections({
  route_id: '1234',
  direction_id: 1,
});
```

### getStopAttributes(query, fields, sortBy)

Queries stop_attributes and returns a promise. The result of the promise is an array of stop_attributes. These are from the non-standard `stop_attributes.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/stop-attributes).

```js
import { getStopAttributes } from 'gtfs';

// Get all stop attributes
getStopAttributes();

// Get stop attributes for specific stop
getStopAttributes({
  stop_id: '1234',
});
```

### getTimetables(query, fields, sortBy)

Queries timetables and returns a promise. The result of the promise is an array of timetables. These are from the non-standard `timetables.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetables.

```js
import { getTimetables } from 'gtfs';

// Get all timetables for an agency
getTimetables();

// Get a specific timetable
getTimetables({
  timetable_id: '1',
});
```

### getTimetableStopOrders(query, fields, sortBy)

Queries timetable_stop_orders and returns a promise. The result of the promise is an array of timetable_stop_orders. These are from the non-standard `timetable_stop_order.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-stop-order).

```js
import { getTimetableStopOrders } from 'gtfs';

// Get all timetable_stop_orders
getTimetableStopOrders();

// Get timetable_stop_orders for a specific timetable
getTimetableStopOrders({
  timetable_id: '1',
});
```

### getTimetablePages(query, fields, sortBy)

Queries timetable_pages and returns a promise. The result of the promise is an array of timetable_pages. These are from the non-standard `timetable_pages.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-pages).

```js
import { getTimetablePages } from 'gtfs';

// Get all timetable_pages for an agency
getTimetablePages();

// Get a specific timetable_page
getTimetablePages({
  timetable_page_id: '2',
});
```

### getTimetableNotes(query, fields, sortBy)

Queries timetable_notes and returns a promise. The result of the promise is an array of timetable_notes. These are from the non-standard `timetable_notes.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-notes).

```js
import { getTimetableNotes } from 'gtfs';

// Get all timetable_notes for an agency
getTimetableNotes();

// Get a specific timetable_note
getTimetableNotes({
  note_id: '1',
});
```

### getTimetableNotesReferences(query, fields, sortBy)

Queries timetable_notes_references and returns a promise. The result of the promise is an array of timetable_notes_references. These are from the non-standard `timetable_notes_references.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-notes-references).

```js
import { getTimetableNotesReferences } from 'gtfs';

// Get all timetable_notes_references for an agency
getTimetableNotesReferences();

// Get all timetable_notes_references for a specific timetable
getTimetableNotesReferences({
  timetable_id: '4',
});
```

### getTripsDatedVehicleJourneys(query, fields, sortBy)

Queries trips_dated_vehicle_journey and returns a promise. The result of the promise is an array of trips_dated_vehicle_journey. These are from the non-standard `trips-dated-vehicle-journey.txt` file. See [documentation and examples of this file](https://www.trafiklab.se/api/trafiklab-apis/gtfs-regional/extra-files/).

```js
import { getTripsDatedVehicleJourneys } from 'gtfs';

// Get all timetable_stop_orders
getTripsDatedVehicleJourneys();
```

### getServiceAlerts(query, fields, sortBy)

Queries service alerts and returns a promise. The result of the promise is an array of service alerts.
These are only valid if you use GTFS-Realtime and have imported Service Alert data.

```js
import { getServiceAlerts } from 'gtfs';

// Get service alerts
getServiceAlerts();
```

### getTripUpdates(query, fields, sortBy)

Queries trip alerts and returns a promise. The result of the promise is an array of trip updates.
These are only valid if you use GTFS-Realtime and have imported Trip Update data.

```js
import { getTripUpdates } from 'gtfs';

// Get all trip updates
getTripUpdates();
```

### getStopTimesUpdates(query, fields, sortBy)

Queries stop times updates and returns a promise. The result of the promise is an array of stop times updates.
These are only valid if you use GTFS-Realtime and have imported Trip Update data.

```js
import { getStopTimesUpdates } from 'gtfs';

// Get all stop times updates
getStopTimesUpdates();
```

### getVehiclePositions(query, fields, sortBy)

Queries vehicle positions and returns a promise. The result of the promise is an array of vehicle location data.
These are only valid if you use GTFS-Realtime and have imported Vehicle Position data.

```js
import { getVehiclePositions } from 'gtfs';

// Get all vehicle position data
getVehiclePositions();
```

### advancedQuery(table, advancedQueryOptions)

Queries the database in a simple manner with support for table joins and custom tables. Returns a promise.
The result of the promise is an array the selected data. Example shows joining stop_times with trips.
Used for advanced scenarios.

```js
import { advancedQuery } from 'gtfs';

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
// Perform a custom query
advancedQuery('stop_times', advancedQueryOptions);
```

### runRawQuery(query)

Queries the database using a raw sql statement. Returns a promise.
The result of the promise is an array the selected data.

```js
import { runRawQuery } from 'gtfs';

// Perform a raw query
runRawQuery('SELECT * FROM stop_times WHERE stop_sequence="1"');
```

### execRawQuery(query)

Executes a statement. Returns a promise containing the result of the execute.

```js
import { execRawQuery } from 'gtfs';

// Purge trips table
execRawQuery('DELETE FROM trips');
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
