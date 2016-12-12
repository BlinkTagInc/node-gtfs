# Node-GTFS

[![NPM version](https://img.shields.io/npm/v/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![David](https://img.shields.io/david/brendannee/node-gtfs.svg)]()
[![npm](https://img.shields.io/npm/dm/gtfs.svg?style=flat)]()

`node-GTFS` loads transit data in [GTFS format](https://developers.google.com/transit/),
unzips it and stores it to a MongoDB database. In addition, this library provides some
methods to query for agencies, routes, stops, times, fares and calendars. It also offers spatial
queries to find nearby stops, routes and agencies.

This library has two parts: the [GTFS import script](#gtfs-import-script) and the [query methods](#query-methods).

## Example Application

The [GTFS-to-HTML](https://github.com/brendannee/gtfs-to-html) app uses
node-gtfs for downloading, importing and querying GTFS data. It provides a good example of
how to use this library.

## Installation

Install node-gtfs directly from [npm](https://npmjs.org):

    npm install mongoose gtfs -g

## Command-line example

    gtfs-import --configPath /path/to/your/custom-config.json

## Code example

    const gtfs = require('gtfs');
    const config = require('config.json');

    gtfs.import(config, (err) => {
      if (err) return console.error(err);

      console.log('Import Successful')
    });

## Configuration

Copy `config-sample.json` to `config.json` and then add your projects configuration to `config.json`.

    cp config-sample.json config.json

| option | type | description |
| ------ | ---- | ----------- |
| `agencies` | array | An array of GTFS files to be imported. |
| `mongoUrl` | string | The URL of the MongoDB database to import to. |
| `verbose` | boolean | Whether or not to print output to the console. |
| `skipDelete` | boolean | Whether or not to skip deleting existing data from the database. |

### Agencies

Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

Each file needs an `agency_key`, a short name you create that is specific to that GTFS file. For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com). You can use the
URL from the agency's website or you can use a URL generated from the transitfeeds.com
API along with your API token.

* Specify a download URL:
```
{
  "agencies": [
    {
      "agency_key": "county-connection",
      "url": "http://countyconnection.com/GTFS/google_transit.zip"
    }
  ]
}
```

* Specify a path to a zipped GTFS file:
```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/gtfs.zip"
    }
  ]
}
```
* Specify a path to an unzipped GTFS file:
```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

* Exclude files - if you don't want all GTFS files to be imported, you can specify an array of files to exclude.

```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/",
      "exclude": [
        "shapes",
        "stops"
      ]
    }
  ]
}
```

* Optionally specify a proj4 projection string to correct poorly formed coordinates in the GTFS file

```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/",
      "proj": "+proj=lcc +lat_1=46.8 +lat_0=46.8 +lon_0=0 +k_0=0.99987742 +x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs"
    }
  ]
}
```

### MongoDB URI

Add the MongoDB URI to `config.json` with the key `mongoUrl`. Running locally, you may want to use `mongodb://localhost:27017/gtfs`.
```
{
  "mongoUrl": "mongodb://localhost:27017/gtfs",
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

### Logging

If you don't want the import script to print any output to the console, you can set `verbose` to `false`. Defaults to `true`.

```
{
  "mongoUrl": "mongodb://localhost:27017/gtfs",
  "agencies": [
    {
      "agency_key": "localAgency",
      "path": ""/path/to/the/unzipped/gtfs/"
    }
  ],
  "verbose": false
}
```

### Deleting existing data

If you don't want the import script to delete all existing data from the database with the same `agency_key`, you can set `skipDelete` to `false`. Defaults to `true`.

```
{
  "mongoUrl": "mongodb://localhost:27017/gtfs",
  "agencies": [
    {
      "agency_key": "localAgency",
      "path": ""/path/to/the/unzipped/gtfs/"
    }
  ],
  "skipDelete": true
}
```

## `gtfs-import` Script

The `gtfs-import` script reads from a JSON configuration file and imports the GTFS files specified to a MongoDB database. [Read more on setting up your configuration file](#configuration).

### Make sure mongo is running

If you want to run this locally, make sure mongo in installed and running.

    mongod

### Run the `gtfs-import` script from Command-line

    gtfs-import

By default, it will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-import --configPath /path/to/your/custom-config.json

### Command Line options

#### Skip Delete
By default, the import script will delete any existing data with the same `agency_key` from your database. If you don't want this to happen, pass the `--skipDelete` flag

    gtfs-import --skipDelete

#### Specify path to config JSON file
You can specify the path to a config file to be used by the import script.

    gtfs-import --configPath /path/to/your/custom-config.json

#### Show help
Show all command line options

    gtfs-import --help


### Use GTFS import script in code

Use `gtfs.import()` in your code to run an import of a GTFS file specified in a config.json file.

    const gtfs = require('gtfs');
    const config = require('config.json');

    gtfs.import(config, (err) => {
      if (err) return console.error(err);

      console.log('Import Successful')
    });

Configuration can be a JSON object in your code

    const gtfs = require('gtfs');
    const config = {
      mongoUrl: 'mongodb://localhost:27017/gtfs',
      agencies: [
        {
          agency_key: 'county-connection',
          url: 'http://countyconnection.com/GTFS/google_transit.zip',
          exclude: [
            'shapes'
          ]
        }
      ]
    };

    gtfs.import(config, (err) => {
      if (err) return console.error(err);

      console.log('Import Successful')
    });

## Query Methods

This library includes many methods you can use in your project to query GTFS data.

### Setup

Include this library.

    var gtfs = require('gtfs');

Connect to mongo via mongoose.

    const mongoose = require('mongoose');
    mongoose.Promise = global.Promise;

    mongoose.connect('YOUR-MONGODB-URI');

If you are running locally, your MongoDB uri might be something like:

    mongodb://localhost:27017/gtfs

You probably want to use the same value used in your [configuration JSON file](#configuration) for importing GTFS.

### Query Methods

Once you have included the library and connected to your MongoDB database you can use the following methods.

#### Agencies

Returns an array of all agencies.

    gtfs.agencies((err, agencies) => {

    });

#### Agencies near a point

Returns an array of agencies within a `radius` of the `lat`, `lon` specified.

    gtfs.getAgenciesByDistance(lat, lon, radius, (err, agencies) => {

    });

`radius` is optional and in miles. Default: 25 miles.

#### Get a specific agency

Returns an agency.  An `agency_key` is required, optionally you can specify an `agency_id` for GTFS files that have more than one agency listed in `agencies.txt`.

    gtfs.getAgency(agency_key, (err, agency) => {

    });

    gtfs.getAgency(agency_key, agency_id, (err, agency) => {

    });

#### Routes for an agency

Returns an array of routes for the `agency_key` specified. An `agency_key` is required, optionally you can specify an `agency_id` for GTFS files that have more than one agency listed in `agencies.txt`.

    gtfs.getRoutesByAgency(agency_key, (err, routes) => {

    });

    gtfs.getRoutesByAgency(agency_key, agency_id, (err, routes) => {

    });

#### Get a specific route

Returns a route for the `route_id` specified.

    gtfs.getRoutesById(agency_key, route_id, (err, routes) => {

    });

#### Routes near a point

Returns an array of routes within a `radius` of the `lat`, `lon` specified.

    gtfs.getRoutesByDistance(lat, lon, radius, (err, routes) => {

    });

`radius` is optional and in miles. Default: 1 mile.

#### Routes that serve a specific stop

Returns an array of routes serving the `agency_key` and `stop_id` specified.

    gtfs.getRoutesByStop(agency_key, stop_id, (err, routes) => {

    });

#### Stops by id

Returns an array of stops, optionally limited to those matching the `stop_ids` specified.

    gtfs.getStops(agency_key, stop_ids, (err, stops) => {

    });

`stop_ids` is optional and can be a single `stop_id` or an array of `stop_ids`.

#### Stops by route

Returns an array of stops along the `route_id` for the `agency_key` and `direction_id` specified

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, (err, stops) => {

    });

#### Stops near a point

Returns an array of stops within a `radius` of the `lat`, `lon` specified

    gtfs.getStopsByDistance(lat, lon, radius, (err, stops) => {

    });

`radius` is optional and in miles. Default: 1 mile

#### Stop times for a trip

Returns an array of stoptimes for the `trip_id` specified

    gtfs.getStoptimesByTrip(agency_key, trip_id, (err, stoptimes) => {

    });

#### Stop times by stop

Returns an array of stoptimes for the `agency_key`, `route_id`, `stop_id` and
`direction_id` specified.

    gtfs.getStoptimesByStop(agency_key, route_id, stop_id, direction_id, (err, stoptimes) => {

    });

#### Trips by route and direction

Returns an array of trips for the `agency_key`, `route_id` and `direction_id`
specified.

    gtfs.getTripsByRouteAndDirection(agency_key, route_id, direction_id, service_ids, (err, trips) => {

    });

`service_ids` is optional

#### Directions by route

Returns an array of directions for the `agency_key` and `route_id` specified.

    gtfs.getDirectionsByRoute(agency_key, route_id, service_ids, (err, directions) => {

    });

Example result:

    [
      {
        route_id: 'Bu-16APR',
        trip_headsign: 'SAN FRANCISCO STATION',
        direction_id: 0
      },
      {
        route_id: 'Bu-16APR',
        trip_headsign: 'DIRIDON STATION',
        direction_id: 1
      },
      { route_id: 'Bu-16APR',
        trip_headsign: 'TAMIEN STATION',
        direction_id: 1
      }
    ];

`service_ids` is optional

#### Shapes by route

Returns an array of shapes for the `agency_key`, `route_id` and `direction_id`
specified sorted by `shape_pt_sequence`.

    gtfs.getShapesByRoute(agency_key, route_id, direction_id, service_ids, (err, shapes) => {

    });

`direction_id` and `service_ids` are  optional

#### Calendars

Returns an array of calendars, optionally bounded by start_date and end_date

    gtfs.getCalendars(agency_key, start_date, end_date, monday, tuesday, wednesday, thursday, friday, saturday, sunday, (err, calendars) => {

    });

#### Calendars by serivce

Returns an array of calendars for the `service_ids` specified

    gtfs.getCalendarsByService(service_ids, (err, calendars) => {

    });

`service_ids` can be a single `service_id` or an array of `service_ids`.

#### Calendar Dates by service

Returns an array of calendarDates for the `service_ids` specified

    gtfs.getCalendarDatesByService(service_ids, (err, calendars) => {

    });

`service_ids` can be a single `service_id` or an array of `service_ids`.

#### Feed Info

Returns feed_info for the agency_key specified

    gtfs.getFeedInfo(agency_key, (err, feedinfo) => {

    });

#### Stop Attributes

Returns an array of stop attributes, optionally limited to those matching the
`stop_ids` specified. These are from the non-standard `stop_attributes.txt`
file.

    gtfs.getStopAttributes(agency_key, stop_ids, (err, stopAttributes) => {

    });

#### Timetables

Returns an array of timetables for the `agency_key` specified. These are from
the non-standard `timetables.txt` file.

    gtfs.getTimetablesByAgency(agency_key, (err, timetables) => {

    });

#### Timetables by id

Returns an array timetable objects matching the `timetable_id` specified. A
timetable may consist of multiple overlapping routes, so more than one timetable
object can be returned. These are from the non-standard `timetables.txt` file.

    gtfs.getTimetable(agency_key, timetable_id, (err, timetable) => {

    });

#### TimetableStopOrders by id

Returns an array of TimetableStopOrder objects matching the `timetable_id`
specified. These are from the non-standard `timetable_stop_order.txt` file.

    gtfs.getTimetableStopOrders(agency_key, timetable_id, (err, timetableStopOrders) => {

    });

#### Timetable Pages

Returns an array of timetable pages for the `agency_key` specified. These are
from the non-standard `timetable_pages.txt` file.

    gtfs.getTimetablePagesByAgency(agency_key, (err, timetablePages) => {

    });

#### Timetable Pages by id

Returns an array timetable pages matching the `timetable_page_id` specified.
These are from the non-standard `timetable_pages.txt` file.

    gtfs.getTimetablePage(agency_key, timetable_page_id, (err, timetable) => {

    });

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/brendannee/node-gtfs/issues).

### Tests

To run tests:

    npm test


### Linting

    npm run lint
