#Node-GTFS

node-GTFS loads grabs transit data in GTFS format from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/), unzips it and stores it to a MongoDB database and provides some simple APIs to query for agencies, routes, stops and times.  It also has spatial queries to find nearby stops and routes.

##Loading data

You need the agency_key from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) - it is in the URL of each individual transit agency's page.  For example, Austin Capital Metro is `capital-area-transit`, Washington DC is `wmata`.  See the [full list of agencies with data](http://www.gtfs-data-exchange.com/agencies).

To load data, run

    ./lib/download.js agency1 agency2 agency3
    
    //Example
    ./lib/download.js capital-area-transit

##Endpoints

###List agencies

    /api/agencies

###List routes for an agency

    /api/routes/:agency
    
    //Example
    /api/routes/capital-area-transit

###List stops for a route

    /api/stops/:agency/:route_id/:direction_id
    
    //Example
    /api/stops/capital-area-transit/34/1
`:direction_id` is optional

###List stop times for a stop    

    /api/times/:agency/:route_id/:stop_id/:direction_id
    
    //Example
    /api/times/capital-area-transit/34/1256/0
`:direction_id` is optional

###List stops near a point

    /api/stopsNearby/:lat/:lon/:radius
    
    //Example
    /api/StopsNearby/37.736531/-122.256964/0.1
`:radius` is optional
