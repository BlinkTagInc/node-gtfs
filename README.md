# Node-GTFS

[![NPM version](https://img.shields.io/npm/v/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![David](https://img.shields.io/david/blinktaginc/node-gtfs.svg)](https://david-dm.org/blinktaginc/node-gtfs)
[![npm](https://img.shields.io/npm/dm/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![CircleCI](https://img.shields.io/github/workflow/status/BlinkTagInc/node-gtfs/Node%20CI.svg)](https://github.com/BlinkTagInc/node-gtfs/actions?query=workflow%3A%22Node+CI%22)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

[![NPM](https://nodei.co/npm/gtfs.png?downloads=true)](https://nodei.co/npm/gtfs/)

`node-GTFS` loads transit data in [GTFS format](https://developers.google.com/transit/) into a SQLite database and provides some methods to query for agencies, routes, stops, times, fares, calendars and other GTFS data. It also offers spatial queries to find nearby stops, routes and agencies and can convert stops and shapes to geoJSON format.

Additionally, this library can export data from the SQLite database back into GTFS (csv) format.

This library has three parts: the [GTFS import script](#gtfs-import-script), the [query methods](#query-methods) and the [GTFS export script](#gtfs-export-script)

## Example Application

The [GTFS-to-HTML](https://gtfstohtml.com) app uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library and is used by over a dozen transit agencies to generate the timetables on their websites.

The [GTFS-to-geojson](https://github.com/blinktaginc/gtfs-to-geojson) app creates geoJSON files for transit routes for use in mapping. It uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library.

The [GTFS-to-chart](https://github.com/blinktaginc/gtfs-to-chart) app generates a stringline chart in D3 for all trips for a specific route using data from an agency's GTFS. It uses `node-gtfs` for downloading, importing and querying GTFS data.

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs -g

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

## Command-line examples

    gtfs-import --gtfsUrl http://www.bart.gov/dev/schedules/google_transit.zip

or 
    
    gtfs-import --gtfsPath /path/to/your/gtfs.zip

or 
    
    gtfs-import --gtfsPath /path/to/your/unzipped/gtfs

or

    gtfs-import --configPath /path/to/your/custom-config.json

    gtfs-export --configPath /path/to/your/custom-config.json

## Code example

```js
const gtfs = require('gtfs');
const config = require('./config.json');

gtfs.import(config)
.then(() => {
  console.log('Import Successful');
})
.catch(err => {
  console.error(err);
});
```

## Command Line Usage

The `gtfs-import` command-line utility will import GTFS into SQLite3.

The `gtfs-export` command-line utility will create GTFS from data previously imported into SQLite3.

### gtfs-import Command-line options

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

## Configuration Files

Copy `config-sample.json` to `config.json` and then add your projects configuration to `config.json`.

    cp config-sample.json config.json

| option | type | description |
| ------ | ---- | ----------- |
| [`agencies`](#agencies) | array | An array of GTFS files to be imported. |
| [`csvOptions`](#csvOptions) | object | Options passed to `csv-parse` for parsing GTFS CSV files. Optional. |
| [`exportPath`](#exportPath) | string | A path to a directory to put exported GTFS files. Optional, defaults to `gtfs-export/<agency_name>`. |
| [`sqlitePath`](#sqlitePath) | string | A path to an SQLite database. Optional, defaults to using an in-memory database. |
| [`verbose`](#verbose) | boolean | Whether or not to print output to the console. Optional, defaults to true. |

### agencies

{Array} Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com). You can use the
URL from the agency's website or you can use a URL generated from the transitfeeds.com
API along with your API token.

* Specify a download URL:
```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip"
    }
  ]
}
```

* Specify a download URL with custom headers:
```json
{
  "agencies": [
    {
      "url": "http://countyconnection.com/GTFS/google_transit.zip",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "bearer 1234567890"
      },
    }
  ]
}
```

* Specify a path to a zipped GTFS file:
```json
{
  "agencies": [
    {
      "path": "/path/to/the/gtfs.zip"
    }
  ]
}
```
* Specify a path to an unzipped GTFS file:
```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

* Exclude files - if you don't want all GTFS files to be imported, you can specify an array of files to exclude.

```json
{
  "agencies": [
    {
      "path": "/path/to/the/unzipped/gtfs/",
      "exclude": [
        "shapes",
        "stops"
      ]
    }
  ]
}
```

* Specify multiple agencies to be imported into the same database

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

{String} A path to a directory to put exported GTFS files. If the directory does not exist, it will be created. Used when running `gtfs-export` script or `gtfs.export()`. Optional, defaults to `gtfs-export/<agency_name>` where `<agency_name>` is a sanitized, [snake-cased](https://en.wikipedia.org/wiki/Snake_case) version of the first `agency_name` in `agency.txt`.

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

If you want to route logs to a custom function, you can pass a function that takes a single `text` argument as `logFunction`. This can't be defined in `config.json` but instead passed in a config object to `gtfs.import()`.  For example:

```js
const gtfs = require('gtfs');

const config = {
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: [
        'shapes'
      ]
    }
  ],
  logFunction: function(text) {
    // Do something with the logs here, like save it or send it somewhere
    console.log(text);
  }
};

gtfs.import(config);
```

## `gtfs-import` Script

The `gtfs-import` script reads from a JSON configuration file and imports the GTFS files specified to a SQLite database. [Read more on setting up your configuration file](#configuration).

### Run the `gtfs-import` script from command-line

    gtfs-import

By default, it will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-import --configPath /path/to/your/custom-config.json

### Use GTFS import script in code

Use `gtfs.import()` in your code to run an import of a GTFS file specified in a config.json file.

```js
const gtfs = require('gtfs');
const config = require('config.json');

gtfs.import(config)
.then(() => {
  console.log('Import Successful');
})
.catch(err => {
  console.error(err);
});
```

Configuration can be a JSON object in your code

```js
const gtfs = require('gtfs');
const config = {
  sqlitePath: '/dev/sqlite/gtfs',
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: [
        'shapes'
      ]
    }
  ]
};

gtfs.import(config)
.then(() => {
  console.log('Import Successful');
})
.catch(err => {
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

### Command Line options

#### Specify path to config JSON file
You can specify the path to a config file to be used by the export script.

    gtfs-export --configPath /path/to/your/custom-config.json

#### Show help
Show all command line options

    gtfs-export --help

### Use GTFS export script in code

Use `gtfs.export()` in your code to run an export of a GTFS file specified in a config.json file.

```js
const gtfs = require('gtfs');
const config = {
  sqlitePath: '/dev/sqlite/gtfs',
  agencies: [
    {
      url: 'http://countyconnection.com/GTFS/google_transit.zip',
      exclude: [
        'shapes'
      ]
    }
  ]
};

gtfs.export(config)
.then(() => {
  console.log('Export Successful');
})
.catch(err => {
  console.error(err);
});
```

## Query Methods

This library includes many methods you can use in your project to query GTFS data. These methods return promises.

Most methods accept three optional arguments: `query`, `fields` and `sortBy`.

#### Query

For example, to get a list of all routes with just `route_id`, `route_short_name` and `route_color` sorted by `route_short_name`:

```js
const db = await gtfs.openDb(config);
const routes = await gtfs.getRoutes(
  {},
  [
    'route_id',
    'route_short_name',
    'route_color'
  ],
  [
    ['route_short_name', 'ASC']
  ]
);
```

To get a list of all trip_ids for a specific route:

```js
const db = await gtfs.openDb(config);
const trips = await gtfs.getTrips(
  {
    route_id: '123'
  },
  [
    'trip_id'
  ]
);
```

To get a few stops by specific stop_ids:

```js
const db = await gtfs.openDb(config);
const stops = await gtfs.getStops(
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
const gtfs = require('gtfs');
```

Open database before making any queries

```js
const db = await gtfs.openDb(config);
```

### gtfs.getAgencies(query, fields, sortBy)

Queries agencies and returns a promise. The result of the promise is an array of agencies.

```js
// Get all agencies
gtfs.getAgencies();

// Get a specific agency
gtfs.getAgencies({
  agency_id: 'caltrain'
});
```

### gtfs.getAttributions(query, fields, sortBy)

Queries attributions and returns a promise. The result of the promise is an array of attributions.

```js
// Get all attributions
gtfs.getAttributions();

// Get a specific attribution
gtfs.getAttributions({
  attribution_id: '123'
});
```

### gtfs.getRoutes(query, fields, sortBy)

Queries routes and returns a promise. The result of the promise is an array of routes.

```js
// Get all routes, sorted by route_short_name
gtfs.getRoutes(
  {},
  [],
  [
    ['route_short_name', 'ASC']
  ]
);

// Get a specific route
gtfs.getRoutes({
  route_id: 'Lo-16APR'
});
```

`getRoutes` allows passing a `stop_id` in the query and it will query stoptimes and trips to find all routes that serve that `stop_id`.

```js
// Get routes that serve a specific stop, sorted by `stop_name`.
gtfs.getRoutes(
  {
    stop_id: '70011'
  },
  [],
  [
    ['stop_name', 'ASC']
  ]
);
```

### gtfs.getStops(query, fields, sortBy)

Queries stops and returns a promise. The result of the promise is an array of stops.

```js
// Get all stops
gtfs.getStops();

// Get a specific stop by stop_id
gtfs.getStops({
  stop_id: '70011'
});
```

`getStops` allows passing a `route_id` in the query and it will query trips and stoptimes to find all stops served by that `route_id`.

```js
// Get all stops for a specific route
gtfs.getStops({
  route_id: 'Lo-16APR'
});
```

`getStops` allows passing a `trip_id` in the query and it will query stoptimes to find all stops on that `trip_id`.

```js
// Get all stops for a specific trip
gtfs.getStops({
  trip_id: '37a'
});
```

### gtfs.getStopsAsGeoJSON(query)

Queries stops and returns a promise. The result of the promise is an geoJSON object of stops. All valid queries for `gtfs.getStops()` work for `gtfs.getStopsAsGeoJSON()`.

```js
// Get all stops for an agency as geoJSON
gtfs.getStopsAsGeoJSON();

// Get all stops for a specific route as geoJSON
gtfs.getStopsAsGeoJSON({
  route_id: 'Lo-16APR'
});
```

### gtfs.getStoptimes(query, fields, sortBy)

Queries `stop_times` and returns a promise. The result of the promise is an array of `stop_times`.

```js
// Get all stoptimes
gtfs.getStoptimes();

// Get all stoptimes for a specific stop
gtfs.getStoptimes({
  stop_id: '70011'
});

// Get all stoptimes for a specific trip, sorted by stop_sequence
gtfs.getStoptimes(
  {
    trip_id: '37a'
  },
  [],
  [
    ['stop_sequence', 'ASC']
  ]
);

// Get all stoptimes for a specific stop and service_id
gtfs.getStoptimes({
  stop_id: '70011',
  service_id: 'CT-16APR-Caltrain-Weekday-01'
});
```

### gtfs.getTrips(query, fields, sortBy)

Queries trips and returns a promise. The result of the promise is an array of trips.

```js
// Get all trips
gtfs.getTrips();

// Get trips for a specific route and direction
gtfs.getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0
});

// Get trips for direction '' or null
gtfs.getTrips({
  route_id: 'Lo-16APR',
  direction_id: null
});

// Get trips for a specific route and direction limited by a service_id
gtfs.getTrips({
  route_id: 'Lo-16APR',
  direction_id: 0,
  service_id: '
});
```

### gtfs.getShapes(query, fields, sortBy)

Queries shapes and returns a promise. The result of the promise is an array of shapes.

```js
// Get all shapes for an agency
gtfs.getShapes();
```

`getShapes` allows passing a `route_id` in the query and it will query trips to find all shapes served by that `route_id`.
  
```js
// Get all shapes for a specific route and direction
gtfs.getShapes({
  route_id: 'Lo-16APR',
});
```

`getShapes` allows passing a `trip_id` in the query and it will query trips to find all shapes served by that `trip_id`.

```js
// Get all shapes for a specific trip_id
gtfs.getShapes({
  trip_id: '37a'
});
```

`getShapes` allows passing a `service_id` in the query and it will query trips to find all shapes served by that `service_id`.

```js
// Get all shapes for a specific service_id
gtfs.getShapes({
  service_id: 'CT-16APR-Caltrain-Sunday-02'
});
```

### gtfs.getShapesAsGeoJSON(query)

Queries shapes and returns a promise. The result of the promise is an geoJSON object of shapes. All valid queries for `gtfs.getShapes()` work for `gtfs.getShapesAsGeoJSON()`.

Returns geoJSON of shapes.

```js
// Get geoJSON of all stops in an agency
gtfs.getShapesAsGeoJSON();

// Get geoJSON of stops along a specific route
gtfs.getShapesAsGeoJSON({
  route_id: 'Lo-16APR'
});

// Get geoJSON of stops for a specific trip
gtfs.getShapesAsGeoJSON({
  trip_id: '37a'
});

// Get geoJSON of stops for a specific `service_id`
gtfs.getShapesAsGeoJSON({
  service_id: 'CT-16APR-Caltrain-Sunday-02'
});
```

### gtfs.getCalendars(query, fields, sortBy)

Queries calendars and returns a promise. The result of the promise is an array of calendars.

```js
// Get all calendars for an agency
gtfs.getCalendars();

// Get calendars for a specific `service_id`
gtfs.getCalendars({
  service_id: 'CT-16APR-Caltrain-Sunday-02'
});
```

### gtfs.getCalendarDates(query, fields, sortBy)

Queries calendar_dates and returns a promise. The result of the promise is an array of calendar_dates.

```js
// Get all calendar_dates for an agency
gtfs.getCalendarDates();

// Get calendar_dates for a specific `service_id`
gtfs.getCalendarDates({
  service_id: 'CT-16APR-Caltrain-Sunday-02'
});
```

### gtfs.getFareAttributes(query, fields, sortBy)

Queries fare_attributes and returns a promise. The result of the promise is an array of fare_attributes.

```js
// Get all `fare_attributes` for an agency
gtfs.getFareAttributes();

// Get `fare_attributes` for a specific `fare_id`
gtfs.getFareAttributes({
  fare_id: '123'
});
```

### gtfs.getFareRules(query, fields, sortBy)

Queries fare_rules and returns a promise. The result of the promise is an array of fare_rules.

```js
// Get all `fare_rules` for an agency
gtfs.getFareRules();

// Get fare_rules for a specific route
gtfs.getFareRules({
  route_id: 'Lo-16APR'
});
```

### gtfs.getFeedInfo(query, fields, sortBy)

Queries feed_info and returns a promise. The result of the promise is an array of feed_infos.

```js
// Get feed_info
gtfs.getFeedInfo();
```

### gtfs.getFrequencies(query, fields, sortBy)

Queries frequencies and returns a promise. The result of the promise is an array of frequencies.

```js
// Get all frequencies
gtfs.getFrequencies();

// Get frequencies for a specific trip
gtfs.getFrequencies({
  trip_id: '1234'
});
```

### gtfs.getLevels(query, fields, sortBy)

Queries levels and returns a promise. The result of the promise is an array of levels.

```js
// Get levels
gtfs.getLevels();
```

### gtfs.getPathways(query, fields, sortBy)

Queries pathways and returns a promise. The result of the promise is an array of pathways.

```js
// Get pathways
gtfs.getPathways();
```

### gtfs.getTransfers(query, fields, sortBy)

Queries transfers and returns a promise. The result of the promise is an array of transfers.

```js
// Get all transfers
gtfs.getTransfers();

// Get transfers for a specific stop
gtfs.getTransfers({
  from_stop_id: '1234'
});
```

### gtfs.getTranslations(query, fields, sortBy)

Queries translations and returns a promise. The result of the promise is an array of translations.

```js
// Get translations
gtfs.getTranslations();
```

### gtfs.getDirections(query, fields, sortBy)

Queries directions and returns a promise. The result of the promise is an array of directions. These are from the non-standard `directions.txt` file. See [documentation and examples of this file](https://trilliumtransit.com/gtfs/reference/#directions).

```js
// Get all directions
gtfs.getDirections();

// Get directions for a specific route
gtfs.getDirections({
  route_id: '1234'
});

// Get directions for a specific route and directioin
gtfs.getDirections({
  route_id: '1234',
  direction_id: 1
});
```

### gtfs.getStopAttributes(query, fields, sortBy)

Queries stop_attributes and returns a promise. The result of the promise is an array of stop_attributes. These are from the non-standard `stop_attributes.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/stop-attributes).

```js
// Get all stop attributes
gtfs.getStopAttributes();

// Get stop attributes for specific stop
gtfs.getStopAttributes({
  stop_id: '1234'
});
```

### gtfs.getTimetables(query, fields, sortBy)

Queries timetables and returns a promise. The result of the promise is an array of timetables. These are from the non-standard `timetables.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetables.

```js
// Get all timetables for an agency
gtfs.getTimetables();

// Get a specific timetable
gtfs.getTimetables({
  timetable_id: '1'
});
```

### gtfs.getTimetableStopOrders(query, fields, sortBy)

Queries timetable_stop_orders and returns a promise. The result of the promise is an array of timetable_stop_orders. These are from the non-standard `timetable_stop_order.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-stop-order).

```js
// Get all timetable_stop_orders
gtfs.getTimetableStopOrders();

// Get timetable_stop_orders for a specific timetable
gtfs.getTimetableStopOrders({
  timetable_id: '1'
});
```

### gtfs.getTimetablePages(query, fields, sortBy)

Queries timetable_pages and returns a promise. The result of the promise is an array of timetable_pages. These are from the non-standard `timetable_pages.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-pages).

```js
// Get all timetable_pages for an agency
gtfs.getTimetablePages();

// Get a specific timetable_page
gtfs.getTimetablePages({
  timetable_page_id: '2'
});
```

### gtfs.getTimetableNotes(query, fields, sortBy)

Queries timetable_notes and returns a promise. The result of the promise is an array of timetable_notes. These are from the non-standard `timetable_notes.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-notes).

```js
// Get all timetable_notes for an agency
gtfs.getTimetableNotes();

// Get a specific timetable_note
gtfs.getTimetableNotes({
  note_id: '1'
});
```

### gtfs.getTimetableNotesReferences(query, fields, sortBy)

Queries timetable_notes_references and returns a promise. The result of the promise is an array of timetable_notes_references. These are from the non-standard `timetable_notes_references.txt` file. See [documentation and examples of this file](https://gtfstohtml.com/docs/timetable-notes-references).

```js
// Get all timetable_notes_references for an agency
gtfs.getTimetableNotesReferences();

// Get all timetable_notes_references for a specific timetable
gtfs.getTimetableNotesReferences({
  timetable_id: '4'
});
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
