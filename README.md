# Node-GTFS

[![NPM version](https://img.shields.io/npm/v/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![David](https://img.shields.io/david/blinktaginc/node-gtfs.svg)](https://david-dm.org/blinktaginc/node-gtfs)
[![npm](https://img.shields.io/npm/dm/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![CircleCI](https://img.shields.io/circleci/project/github/BlinkTagInc/node-gtfs.svg)](https://circleci.com/gh/BlinkTagInc/node-gtfs/tree/master)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

[![NPM](https://nodei.co/npm/gtfs.png?downloads=true)](https://nodei.co/npm/gtfs/)

`node-GTFS` loads transit data in [GTFS format](https://developers.google.com/transit/) into a MongoDB database and provides some methods to query for agencies, routes, stops, times, fares, calendars and other GTFS data. It also offers spatial queries to find nearby stops, routes and agencies and can convert stops and shapes to geoJSON format.

This library has two parts: the [GTFS import script](#gtfs-import-script) and the [query methods](#query-methods).

## Example Application

The [GTFS-to-HTML](https://github.com/blinktaginc/gtfs-to-html) app uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library.

The [GTFS-to-geojson](https://github.com/blinktaginc/gtfs-to-geojson) app creates geoJSON files for transit routes for use in mapping. It uses `node-gtfs` for downloading, importing and querying GTFS data. It provides a good example of how to use this library.

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs mongoose -g

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

Note: [Mongoose](http://mongoosejs.com/) is a peer dependency of `node-gtfs`, so when installing globally be sure to install mongoose as well. If you are writing a application that uses `node-gtfs` as a dependency, then you'll need to include mongoose as a dependency in your project's `package.json`.

## Command-line example

    gtfs-import [--configPath /path/to/your/custom-config.json] [--skipDelete]

## Code example

    const gtfs = require('gtfs');
    const mongoose = require('mongoose');
    const config = require('./config.json');

    mongoose.connect(config.mongoUrl);

    gtfs.import(config)
    .then(() => {
      console.log('Import Successful');
      return mongoose.connection.close();
    })
    .catch(err => {
      console.error(err);
    });

---

## Breaking changes in version 1.0.0

As of version 1.0.0, all `node-gtfs` methods have changed to accept a query object instead of individual arguments. This allows for all fields of all GTFS files to be queried using this library. Most method names have been changed to be more general and more specific methods have been removed. For example, `getRoutes` now replaces `getRoutesByAgency`, `getRoutesById`, `getRoutesByDistance` and `getRoutesByStop`.

    // Old method with individual arguments, no longer supported in `node-gtfs` 1.0.0
    gtfs.getRoutesByStop(agency_key, stop_id)
    .then(routes => {
      // do something with the array of `routes`
    })

    // Query in `node-gtfs` version 1.0.0
    gtfs.getRoutes({
      agency_key: 'caltrain',
      stop_id: '123'
    })
    .then(routes => {
      // do something with the array of `routes`
    })

Additionally, as of version 0.11.0, `node-gtfs` methods don't support callbacks. Use promises instead:

    gtfs.getAgencies()
    .then(agencies => {
      // do something with the array of `agencies`
    })
    .catch(err => {
      // handle errors here
    });

Or, you use async/await:

    const myAwesomeFunction = async () => {
      try {
        const agencies = await gtfs.getAgencies();
      } catch (error) {
        // handle errors here
      }
    }

---

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

Add the MongoDB URI to `config.json` with the key `mongoUrl`. Running locally, you could use something like `mongodb://localhost:27017/gtfs`.
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

If you don't want the import script to delete all existing data from the database with the same `agency_key`, you can set `skipDelete` to `true`. Defaults to `false`.

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

### Make sure MongoDB is running

If you want to run this locally, make sure MongoDB in installed and running.

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
    const mongoose = require('mongoose');
    const config = require('config.json');

    mongoose.connect(config.mongoUrl);

    gtfs.import(config)
    .then(() => {
      console.log('Import Successful');
      return mongoose.connection.close();
    })
    .catch(err => {
      console.error(err);
    });

Configuration can be a JSON object in your code

    const gtfs = require('gtfs');
    const mongoose = require('mongoose');
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

    mongoose.connect(config.mongoUrl);

    gtfs.import(config)
    .then(() => {
      console.log('Import Successful');
      return mongoose.connection.close();
    })
    .catch(err => {
      console.error(err);
    });

## Query Methods

This library includes many methods you can use in your project to query GTFS data. These methods return promises.

Most methods accept three arguments: `query`, `projection` and `options`. `projection` and `options` are optional and are passed to the [mongoose `find` query](http://mongoosejs.com/docs/api.html#find_find).

#### Query

For example, to get a list of all agencies within 5 miles of a specific point:

    gtfs.getAgencies({
      within: {
        lat: 37.7749,
        lon: -122.4194,
        radius: 5
      }
    })
    .then(agencies => {
      // Do something with the array of `agencies`
    })
    .catch(err => {
      // Be sure to handle errors here
    });

#### Projection
By default, `projection` is set to exclude mongo `_id`. [`projection`](http://mongoosejs.com/docs/api.html#query_Query-select) allows specifying which fields you would like returned. For instance:

    // Gets all agencies but limits results to only include `agency_name` and `agency_lang`.
    gtfs.getAgencies({}, {
      _id: 0,
      agency_name: 1,
      agency_lang: 1
    })
    .then(agencies => {
      // each Agency only has `agency_name` and `agency_lang`
    });


#### Options
Mongoose allows [numerous options to be set on the query](http://mongoosejs.com/docs/api.html#query_Query-setOptions). You can specify things like `sort` and `limit` using the `options` parameter.  By default, `options` is set to `lean: true` to return a plain javascript object.

    // Gets all agencies sorted by `agency_name`
    gtfs.getAgencies({}, {}, {
      sort: {agency_name: 1}
    })
    .then(agencies => {

    });

### Setup

Include this library.

    var gtfs = require('gtfs');

Connect to mongo via mongoose.

    const mongoose = require('mongoose');
    mongoose.connect('YOUR-MONGODB-URI');

If you are running locally, your MongoDB uri might be something like:

    mongodb://localhost:27017/gtfs

You probably want to use the same value used in your [configuration JSON file](#configuration) for importing GTFS.


### gtfs.getAgencies(query, projection, options)

Queries agencies and returns a promise. The result of the promise is an array of agencies.

    // Get all agencies
    gtfs.getAgencies()
    .then(agencies => {

    });

    // Get all agencies within a a `radius` of the `lat`, `lon` specified.
    // `radius` is optional and in miles. Default: 25 miles.
    gtfs.getAgencies({
      within: {
        lat: 37.7749,
        lon: -122.4194,
        radius: 5
      }
    })
    .then(agencies => {

    });

    // Get a specific agency
    gtfs.getAgencies({
      agency_key: 'caltrain'
    })
    .then(agencies => {

    });

    // Get a specific agency by `agency_name`
    gtfs.getAgencies({
      agency_name: 'Caltrain'
    })
    .then(agencies => {

    });

    // Get all agencies in a specific timezone, limited to just `agency_name` sorted alphabetically
    gtfs.getAgencies({
      agency_timezone: 'America/Los_Angeles'
    }, {
      _id: 0,
      agency_name: 1
    }, {
      sort: {agency_name: 1}  
    })
    .then(agencies => {

    });


### gtfs.getRoutes(query, projection, options)

Queries routes and returns a promise. The result of the promise is an array of routes.

    // Get all routes for an agency
    gtfs.getRoutes({
      agency_key: 'caltrain'
    })
    .then(routes => {

    });

    // Get a specific route
    gtfs.getRoutes({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR'
    })
    .then(routes => {

    });

    // Get a few routes
    const routeIds = [
      'Bu-16APR',
      'Lo-16APR'
    ]
    gtfs.getRoutes({
      agency_key: 'caltrain',
      route_id: {
        $in: routeIds
      }
    })
    .then(routes => {

    });

    // Get all routes within a radius of the `lat`, `lon` specified.
    // `radius` is optional and in miles. Default: 1 mile.
    gtfs.getRoutes({
      within: {
        lat: 37.7749,
        lon: -122.4194,
        radius: 5
      }
    })
    .then(routes => {

    });


    // Get routes that serve a specific stop, sorted by `stop_name`.
    gtfs.getRoutes({
      agency_key: 'caltrain',
      stop_id: '70011'
    }, {
      _id: 0
    }, {
      sort: {stop_name: 1}
    })
    .then(routes => {

    });

### gtfs.getStops(query, projection, options)

Queries stops and returns a promise. The result of the promise is an array of stops.

    // Get all stops for an agency
    gtfs.getStops({
      agency_key: 'caltrain'
    })
    .then(stops => {

    });

    // Get a specific stop by stop_id
    gtfs.getStops({
      agency_key: 'caltrain',
      stop_id: '70011'
    })
    .then(stops => {

    });

    // Get a few stops
    const stopIds = [
      '70011',
      '70012'
    ];
    gtfs.getStops({
      agency_key: 'caltrain',
      stop_id: {
        $in: stopIds
      }
    })
    .then(stops => {

    });

    // Get all stops for a specific route and direction
    gtfs.getStops({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 1
    })
    .then(stops => {

    });

    // Get all stops within a `radius` of the `lat`, `lon` specified.
    // `radius` is optional and in miles. Default: 1 mile.
    gtfs.getStops({
      within: {
        lat: 37.7749,
        lon: -122.4194,
        radius: 5
      }
    })
    .then(stops => {

    });

### gtfs.getStopsAsGeoJSON(query)

Queries stops and returns a promise. The result of the promise is an geoJSON object of stops. All valid queries for `gtfs.getStops()` work for `gtfs.getStopsAsGeoJSON()`.

    // Get all stops for an agency as geoJSON
    gtfs.getStopsAsGeoJSON({
      agency_key: 'caltrain'
    })
    .then(geojson => {

    });

    // Get all stops for a specific route and direction as geoJSON
    gtfs.getStopsAsGeoJSON({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 1
    })
    .then(geojson => {

    });

`stop_ids` is optional and can be a single `stop_id` or an array of `stop_ids`.

### gtfs.getStoptimes(query, projection, options)

Queries `stop_times` and returns a promise. The result of the promise is an array of `stop_times`. `agency_key` is required. `stop_times` are sorted by `stop_sequence` by default, but can be overridden by passing a `sort` parameter in an options object.

    // Get all stoptimes for a specific stop
    gtfs.getStoptimes({
      agency_key: 'caltrain',
      stop_id: '70011'
    })
    .then(stoptimes => {

    });

    // Get all stoptimes for a specific stop, route and direction
    gtfs.getStoptimes({
      agency_key: 'caltrain',
      stop_id: '70011',
      route_id: 'Lo-16APR',
      direction_id: 0
    })
    .then(stoptimes => {

    });

    // Get all stoptimes for a specific stop and service_id
    gtfs.getStoptimes({
      agency_key: 'caltrain',
      stop_id: '70011',
      service_id: 'CT-16APR-Caltrain-Weekday-01'
    })
    .then(stoptimes => {

    });

    // Get all stoptimes for a route and sort by stop_id
    gtfs.getStoptimes({
      agency_key: 'caltrain',
      route_id: '10'
    }, {
      _id: 0
    }, {
      sort: {stop_id: 1}
    })
    .then(stoptimes => {

    });

### gtfs.getTrips(query, projection, options)

Queries trips and returns a promise. The result of the promise is an array of trips.

    // Get trips for a specific route and direction
    gtfs.getTrips({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 0
    })
    .then(trips => {

    });

    // Get trips for a specific route and direction limited by service_ids
    const serviceIds = [
      'CT-16APR-Caltrain-Saturday-02',
      'CT-16APR-Caltrain-Sunday-02'
    ];
    gtfs.getTrips({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 0,
      service_id: {
        $in: serviceIds
      }
    })
    .then(trips => {

    });

    // Get only trip_ids for trips on a specific route and direction, sorted by trip_id
    gtfs.getTrips({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 0
    }, {
      _id: 0,
      trip_id: 1
    }, {
      sort: {trip_id: 1}
    })
    .then(trips => {

    });

### gtfs.getDirectionsByRoute(query)

Queries trips and returns a promise. The result of the promise is an array of direction_ids. Useful to determine if a route has two directions or just one. `agency_key` and `route_id` are required.

    // Find all directions for a specific route
    gtfs.getDirectionsByRoute({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR'
    })
    .then(directions => {

    });

    // Find all directions for a specific route and service_id
    gtfs.getDirectionsByRoute({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      service_id: 'CT-16APR-Caltrain-Sunday-02'
    })
    .then(directions => {

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

### gtfs.getShapes(query, projection, options)

Queries shapes and returns a promise. The result of the promise is an array of shapes sorted by `shape_pt_sequence`. Sort can be overridden using the `sort` option.

    // Get all shapes for an agency
    gtfs.getShapes({
      agency_key: 'caltrain'
    })
    .then(shapes => {

    });

    // Get all shapes for a specific route and direction
    gtfs.getShapes({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 0
    })
    .then(shapes => {

    });

    // Get all shapes for a specific trip_id
    gtfs.getShapes({
      agency_key: 'caltrain',
      trip_id: '37a'
    })
    .then(shapes => {

    });

    // Get all shapes for a few trip_ids
    const tripIds = [
      '37a',
      '39a'
    ];
    gtfs.getShapes({
      agency_key: 'caltrain',
      trip_id: {
        $in: tripIds
      }
    })
    .then(shapes => {

    });

### gtfs.getShapesAsGeoJSON(query)

Queries shapes and returns a promise. The result of the promise is an geoJSON object of shapes. All valid queries for `gtfs.getShapes()` work for `gtfs.getShapesAsGeoJSON()`.

Returns geoJSON of shapes for the `agency_key` specified.

    // Get geoJSON of all routes in an agency
    gtfs.getShapesAsGeoJSON({
      agency_key: 'caltrain'
    })
    .then(geojson => {

    });

    // Get geoJSON of a specific route in an agency
    gtfs.getShapesAsGeoJSON({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR'
    })
    .then(geojson => {

    });

    // Get geoJSON of a specific route and direction in an agency
    gtfs.getShapesAsGeoJSON({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR',
      direction_id: 0
    })
    .then(geojson => {

    });

### gtfs.getCalendars(query, projection, options)

Queries calendars and returns a promise. The result of the promise is an array of calendars.

    // Get all calendars for an agency
    gtfs.getCalendars({
      agency_key: 'caltrain'
    })
    .then(calendars => {

    });

    // Get calendars for an agency between two dates that apply on a Tuesday
    gtfs.getCalendars({
      agency_key: 'caltrain',
      start_date: {$lt: 20160405},
      end_date: {$gte: 20160404},
      tuesday: 1
    })
    .then(calendars => {

    });

    // Get calendars for an agency by service_ids
    gtfs.getCalendars({
      agency_key: 'caltrain',
      service_id: 'CT-16APR-Caltrain-Sunday-02'
    })
    .then(calendars => {

    });

    // Get calendars for an specific route
    gtfs.getCalendars({
      agency_key: 'caltrain',
      route_id: 'TaSj-16APR'
    })
    .then(calendars => {

    });

    // Get calendars for several routes
    gtfs.getCalendars({
      agency_key: 'caltrain',
      route_id: {$in: ['TaSj-16APR', 'Lo-16APR']}
    })
    .then(calendars => {

    });

### gtfs.getFeedInfo(query, projection, options)

Queries feed_info and returns a promise. The result of the promise is an array of feed_infos.

    // Get feed_info for a specified agency
    gtfs.getFeedInfo({
      agency_key: 'caltrain'
    })
    .then(feedInfos => {

    });

### gtfs.getFareRules(query, projection, options)

Queries fare_rules and returns a promise. The result of the promise is an array of fare_rules.

    // Get fare_rules for a route
    gtfs.getFareRules({
      agency_key: 'caltrain',
      route_id: 'Lo-16APR'
    })
    .then(fareRules => {

    });

### gtfs.getFrequencies(query, projection, options)

Queries frequencies and returns a promise. The result of the promise is an array of frequencies.

    // Get frequencies for a specific trip
    gtfs.getFrequencies({
      agency_key: 'caltrain',
      trip_id: '1234'
    })
    .then(frequencies => {

    });


### gtfs.getTransfers(query, projection, options)

Queries transfers and returns a promise. The result of the promise is an array of transfers.

    // Get transfers for a specific stop_id
    gtfs.getTransfers({
      agency_key: 'caltrain',
      from_stop_id: '1234'
    })
    .then(transfers => {

    });

### gtfs.getStopAttributes(query, projection, options)

Queries stop_attributes and returns a promise. The result of the promise is an array of stop_attributes. These are from the non-standard `stop_attributes.txt` file. See [documentation and examples of this file](https://github.com/BlinkTagInc/gtfs-to-html#build-stop_attributestxt).

    // Get stop attributes for a few stops
    const stopIds = [
      '70011',
      '70012'
    ];
    gtfs.getStopAttributes({
      agency_key: 'caltrain',
      stop_id: {
        $in: stopIds
      }
    })
    .then(stopAttributes => {

    });

### gtfs.getTimetables(query, projection, options)

Queries timetables and returns a promise. The result of the promise is an array of timetables. These are from the non-standard `timetables.txt` file. See [documentation and examples of this file](https://github.com/BlinkTagInc/gtfs-to-html#build-timetablestxt).

    // Get all timetables for an agency
    gtfs.getTimetables({
      agency_key: 'caltrain'
    })
    .then(timetables => {

    });

    // Get a specific timetable
    gtfs.getTimetables({
      agency_key: 'caltrain',
      timetable_id: '1'
    })
    .then(timetables => {

    });

### gtfs.getTimetableStopOrders(query, projection, options)

Queries timetable_stop_orders and returns a promise. The result of the promise is an array of timetable_stop_orders. These are from the non-standard `timetable_stop_order.txt` file. See [documentation and examples of this file](https://github.com/BlinkTagInc/gtfs-to-html#build-timetable_stop_ordertxt).

    // Get timetable_stop_orders for a specific timetable
    gtfs.getTimetableStopOrders({
      agency_key: 'caltrain',
      timetable_id: '1'
    })
    .then(TimetableStopOrders => {

    });

### gtfs.getTimetablePages(query, projection, options)

Queries timetable_pages and returns a promise. The result of the promise is an array of timetable_pages. These are from the non-standard `timetable_pages.txt` file. See [documentation and examples of this file](https://github.com/BlinkTagInc/gtfs-to-html#build-timetable_pagestxt).

    // Get all timetable_pages for an agency
    gtfs.getTimetablePages({
      agency_key: 'caltrain'
    })
    .then(timetablePages => {

    });

    // Get a specific timetable_page
    gtfs.getTimetablePages({
      agency_key: 'caltrain',
      timetable_page_id: '2'
    })
    .then(timetablePages => {

    });

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/node-gtfs/issues).

### Tests

To run tests:

    npm test

To run a specific test:

    NODE_ENV=test mocha ./test/mocha/gtfs.get-stoptimes.js


### Linting

    npm run lint
