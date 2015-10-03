#Node-GTFS

[![NPM version](https://img.shields.io/npm/v/gtfs.svg?style=flat)](https://www.npmjs.com/package/gtfs)
[![David](https://img.shields.io/david/brendannee/node-gtfs.svg)]()
[![npm](https://img.shields.io/npm/dm/gtfs.svg?style=flat)]()

`node-GTFS` loads transit data in [GTFS format](https://developers.google.com/transit/) from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/), unzips it and stores it to a MongoDB database and provides some methods to query for agencies, routes, stops and times.  It also has spatial queries to find nearby stops, routes and agencies.

##Setup

You can clone from github:

    git clone git@github.com:brendannee/node-gtfs.git

    cd node-gtfs

    npm install

or install directly from npm:

    npm install gtfs

    cd node_modules/gtfs

##Configuration for loading data

Copy `config-sample.js` to `config.js`.

    cp config-sample.js config.js

Before you can use node-GTFS you must specify the transit agencies you'd like to use.

You can specify agencies using their [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) `dataexchange_id`, a `url` to the GTFS file or a local `path`.

To download from GTFS Data Exchange, you'll need the `dataexchange_id` for each agency you want to include from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) - it is in the URL of each individual transit agency's page.

A full list of agencies is available via the [GTFS Data Exchange API](http://www.gtfs-data-exchange.com/api/agencies).

For example, Austin Capital Metro is `capital-area-transit`, Washington DC is `wmata`.

Add the list of agency keys you'd like to support to `config.js` as an array called `agencies`.

The mongodb URI should also be configured in `config.js`. Default database URI is:
`mongodb://localhost:27017/gtfs`

##Loading Data

### Make sure mongo is running

    mongod

### Run the download script

    npm run download

or

    node ./scripts/download

### Scheduling

To keep schedules up to date, you could schedule this to occur once per day.

# Querying data

You can include this library in your project to expose some functions for querying GTFS data.

## Including

You can include this library.

    var gtfs = require('gtfs');


##Endpoints

###Agencies

Returns an array of all agencies

    gtfs.agencies(function(err, agencies) {

    });

###Agencies near a point

Returns an array of agencies within a `radius` of the `lat`, `lon` specified

    gtfs.getAgenciesByDistance(lat, lon, radius, function(err, agencies) {

    });

###Get a specific agency

Returns an agency

    gtfs.getAgency(agency_key, function(err, agency) {

    });

###Routes for an agency

Returns an array of routes for the `agency_key` specified

    gtfs.getRoutesByAgency(agency_key, function(err, routes) {

    });

###Get a specific route

Returns a route for the `route_id` specified

    gtfs.getRoutesById(agency_key, route_id, function(err, routes) {

    });

###Routes near a point

Returns an array of routes within a `radius` of the `lat`, `lon` specified

    gtfs.getRoutesByDistance(lat, lon, radius, function(err, routes) {

    });

`radius` is optional and in miles.  Default: 1 mile

###Routes that serve a specific stop

Returns an array of routes serving the `agency_key` and `stop_id` specified

    gtfs.getRoutesByStop(agency_key, stop_id, function(err, routes) {

    });

###Stops by id

Returns an array of stops matching the `stop_ids` specified

    gtfs.getStops(agency_key, stop_ids, function(err, stops) {

    });

`stop_ids` can be a single `stop_id` or an array of `stop_ids`.

###Stops by route

Returns an array of stops along the `route_id` for the `agency_key` and `direction_id` specified

    gtfs.getStopsByRoute(agency_key, route_id, direction_id, function(err, stops) {

    });

###Stops near a point

Returns an array of stops within a `radius` of the `lat`, `lon` specified

    gtfs.getStopsByDistance(lat, lon, radius, function(err, stops) {

    });

`radius` is optional and in miles.  Default: 1 mile

###Stop times for a trip

Returns an array of stoptimes for the `trip_id` specified

    gtfs.getStoptimesByTrip(agency_key, trip_id, function(err, stoptimes) {

    });

###Stop times by stop

Returns an array of stoptimes for the `agency_key`, `route_id`, `stop_id` and `direction_id` specified

    gtfs.getStoptimesByStop(gency_key, route_id, stop_id, direction_id, function(err, stoptimes) {

    });

###Trips by route and direction

Returns an array of trips for the `agency_key`, `route_id` and `direction_id` specified

    gtfs.getTripsByRouteAndDirection(gency_key, route_id, direction_id, service_ids, function(err, trips) {

    });

`service_ids` is optional

###Direction name by route

Returns an object of `{northData: "Headsign north", southData: "Headsign south"}` for the `agency_key` and `route_id` specified

    gtfs.findBothDirectionNames(agency_key, route_id, function(err, directionNames) {

    });

###Shapes by route

Returns an array of shapes for the `agency_key`, `route_id` and `direction_id` specified

    gtfs.getShapesByRoute(agency_key, route_id, direction_id, function(err, shapes) {

    });

###Coordinates by route

Returns an array of coordinates for the `agency_key`, and `route_id` specified

    gtfs.getCoordinatesByRoute(agency_key, route_id, function(err, coordinates) {

    });

###Calendars

Returns an array of calendars, optionally bounded by start_date and end_date

    gtfs.getCalendars(agency_key, start_date, end_date, monday, tuesday, wednesday, thursday, friday, saturday, sunday, function(err, calendars) {

    });

###Calendars by serivce

Returns an array of calendars for the `service_ids` specified

    gtfs.getCalendarsByService(service_ids, function(err, calendars) {

    });

`service_ids` can be a single `service_id` or an array of `service_ids`.

###Calendar Dates by service

Returns an array of calendarDates for the `service_ids` specified

    gtfs.getCalendarDatesByService(service_ids, function(err, calendars) {

    });

`service_ids` can be a single `service_id` or an array of `service_ids`.

###Feed Info

Returns feed_info for the agency_key specified

    gtfs.getFeedInfo(agency_key, function(err, feedinfo) {

    });

###Timetables

Returns an array of timetables for the `agency_key` specified

    gtfs.getTimetablesByAgency(agency_key, function(err, timetables) {

    });

###Timetable by id

Returns a timetable object matching the `timetable_id` specified

    gtfs.getTimetable(agency_key, timetable_id, function(err, timetable) {

    });

###Route Directions by Route

Returns a route directions object matching the `route_id` and `direction_id` specified

    gtfs.getRouteDirection(agency_key, route_id, direction_id, function(err, routeDirection) {

    });

##Pulling in updated transit data

Re-run the download script whenever you need to refresh the database. You may want to schedule this with a cronjob.  Heroku lets you do this with [scheduler](https://devcenter.heroku.com/articles/scheduler).

## License

(The MIT License)

Copyright (c) 2012 Brendan Nee <me@bn.ee>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
