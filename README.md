#Node-GTFS

node-GTFS loads transit data in [GTFS format](https://developers.google.com/transit/) from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/), unzips it and stores it to a MongoDB database and provides some simple APIs to query for agencies, routes, stops and times.  It also has spatial queries to find nearby stops, routes and agencies.

##Loading data

You need the agency_key from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) - it is in the URL of each individual transit agency's page.  For example, Austin Capital Metro is `capital-area-transit`, Washington DC is `wmata`.  See the [full list of agencies with data](http://www.gtfs-data-exchange.com/agencies). There is a [json file](https://github.com/brendannee/node-gtfs/blob/master/agencies.json) with all tranit agency names and keys in the repo.

###To load data

    node ./lib/download.js agency1 agency2 agency3
    
    //Example
    node ./lib/download.js san-francisco-municipal-transportation-agency ac-transit

To keep schedules up to date, you might want to schedule this to be daily.

###To use the APIs

    node index.js

##Endpoints

###List agencies

    /api/agencies

###List agencies near a point

    /api/agencies/:lat/:lon/:radius
    
    //Example
    /api/agencies/37.73/-122.25/0.25
`:radius` is optional and in miles.  Default: 0.25 miles
Returns all agencies that serve the 100 nearest stops within the specified radius

###List routes for an agency

    /api/routes/:agency
    
    //Example
    /api/routes/san-francisco-municipal-transportation-agency

###List routes near a point

    /api/routesNearby/:lat/:lon/:radius
    
    //Example
    /api/routesNearby/37.73/-122.25/0.25
`:radius` is optional and in miles.  Default: 0.25 miles
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
`:radius` is optional and in miles.  Default: 0.25 miles
Returns the 100 nearest stops within the specified radius

###List stop times for a stop    

    /api/times/:agency/:route_id/:stop_id/:direction_id
    
    //Example
    /api/times/san-francisco-municipal-transportation-agency/34/1256/0
`:direction_id` is optional


## License

(The MIT License)

Copyright (c) 2012 Brendan Nee <me@bn.ee>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
