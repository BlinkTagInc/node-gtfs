#Node-GTFS

node-GTFS loads grabs transit data in GTFS format from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/), unzips it and stores it to a MongoDB database and provides some simple APIs to query for agencies, routes, stops and times.  It also has spatial queries to find nearby stops and routes.

##Loading data

You need the agency_key from [GTFS Data Exchange](http://www.gtfs-data-exchange.com/) - it is in the URL of each individual transit agency's page.  For example, Austin Capital Metro is `capital-area-transit`, Washington DC is `wmata`.  See the [full list of agencies with data](http://www.gtfs-data-exchange.com/agencies).

To load data, run

    ./lib/download.js agency1 agency2 agency3
    
    //Example
    ./lib/download.js san-francisco-municipal-transportation-agency ac-transit

##Endpoints

###List agencies

    /api/agencies

###List routes for an agency

    /api/routes/:agency
    
    //Example
    /api/routes/san-francisco-municipal-transportation-agency

###List stops for a route

    /api/stops/:agency/:route_id/:direction_id
    
    //Example
    /api/stops/san-francisco-municipal-transportation-agency/34/1
`:direction_id` is optional

###List stop times for a stop    

    /api/times/:agency/:route_id/:stop_id/:direction_id
    
    //Example
    /api/times/san-francisco-municipal-transportation-agency/34/1256/0
`:direction_id` is optional

###List stops near a point

    /api/stopsNearby/:lat/:lon/:radius
    
    //Example
    /api/StopsNearby/37.73/-122.25/0.25
`:radius` is optional and in miles
