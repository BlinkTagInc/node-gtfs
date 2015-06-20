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

Before you can use node-GTFS you must specify agencies to download from GTFS Data Exchange. You need the `dataexchange_id` for each agency you want to include from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) - it is in the URL of each individual transit agency's page.

A full list of agencies is available via the [GTFS Data Exchange API](http://www.gtfs-data-exchange.com/api/agencies).

For example, Austin Capital Metro is `capital-area-transit`, Washington DC is `wmata`.

Copy `config-sample.js` to `config.js`.

    co config-sample.js config.js

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

# Example Application

An example app is provided that creates some restful API endpoints and has a simple frontend for viewing and exploring transit data.  It is in `examples/express`.


## Running the example app locally

### Run the example site

    cd examples/express

### Install dependencies

    npm install

    bower install

### Make sure mongo is running

    mongod

### Run the example app

    debug=node-gtfs-exampleapp npm start

### View in your browser

Visit `localhost:3000` in your browser


##Endpoints

###List agencies

    /api/agencies

###List agencies near a point

    /api/agenciesNearby/:lat/:lon/:radius

    //Example
    /api/agenciesNearby/37.73/-122.25/10
`:radius` is optional and in miles.  Default: 25 miles
Returns all agencies that serve the 100 nearest stops within the specified radius

###List routes for an agency

    /api/routes/:agency

    //Example
    /api/routes/san-francisco-municipal-transportation-agency

###List routes near a point

    /api/routesNearby/:lat/:lon/:radius

    //Example
    /api/routesNearby/37.73/-122.25/0.25
`:radius` is optional and in miles.  Default: 1 mile
Returns all routes that stop at the 100 nearest stops within the specified radius

###List stops for a route

    /api/stops/:agency/:route_id/:direction_id

    //Example
    /api/stops/san-francisco-municipal-transportation-agency/34/1
`:direction_id` is optional

###List stops near a point

    /api/stopsNearby/:lat/:lon/:radius

    //Example
    /api/StopsNearby/37.73/-122.25/0.25
`:radius` is optional and in miles.  Default: 1 mile
Returns the 100 nearest stops within the specified radius

###List stop times for a stop

    /api/times/:agency/:route_id/:stop_id/:direction_id

    //Example
    /api/times/san-francisco-municipal-transportation-agency/34/1256/0
`:direction_id` is optional


##Hosting the Example App with Heroku and MongoHQ

Create app on Heroku

    $ heroku apps:create YOURAPPNAME

Add MongoHQ to your app

    $ heroku addons:add mongohq:sandbox

MONGOHQ creates a user, database and exports it as a `MONGOHQ_URL` environment variable.

Add a `MONGO_URL` config variable to heroku with the same URL as the `MONGOHQ_URL`.

Push your app to Heroku

    $ git push heroku master

Execute the download script to populate the database with the agency data specified in config.js

    $ heroku run node ./scripts/download


##Pulling in updated transit data

Re-run the download script whenever you need to refresh the database. You may want to schedule this with a cronjob.  Heroku lets you do this with [scheduler](https://devcenter.heroku.com/articles/scheduler).

## License

(The MIT License)

Copyright (c) 2012 Brendan Nee <me@bn.ee>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
