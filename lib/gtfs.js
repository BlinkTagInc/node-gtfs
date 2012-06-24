//load config.js
try {
  var config = require('../config.js');
} catch (e) {
  console.log(e)
}

var async = require('async')
  , mongoose = require('mongoose')
  , _ = require('underscore')
  , utils = require('./utils')
  , dbName = process.env['MONGO_NODE_DATABASE'] || config.mongo_node_database
  , host = process.env['MONGO_NODE_HOST'] || config.mongo_node_host
  , port = process.env['MONGO_NODE_PORT'] || config.mongo_node_port
  , db = (port) ? mongoose.connect(host, dbName, port) : mongoose.connect(host, dbName);

require('../models/Agency');
require('../models/Calendar');
require('../models/CalendarDate');
require('../models/FareAttribute');
require('../models/FareRule');
require('../models/FeedInfo');
require('../models/Frequencies');
require('../models/Route');
require('../models/Stop');
require('../models/StopTime');
require('../models/Transfer');
require('../models/Trip');

var Agency = db.model('Agency')
  , Calendar = db.model('Calendar')
  , Route = db.model('Route')
  , Stop = db.model('Stop')
  , StopTime = db.model('StopTime')
  , Trip = db.model('Trip');


module.exports = {    
  agencies: function(cb){
    //gets a list of all agencies

    Agency.find({}, cb);
  },

  getRoutesByAgency: function(agency_key, cb){
    //gets routes for one agency

    Route.find({ agency_key: agency_key }, cb);
  },

  
  getAgenciesByDistance: function(lat, lon, radius, cb){
    //gets all agencies within a radius
    
    if (_.isFunction(radius)) {
      cb = radius;
      radius = 25; // default is 25 miles
    }

    lat = parseFloat(lat);
    lon = parseFloat(lon);

    var radiusInDegrees = Math.round(radius/69*100000)/100000;
    
    Agency
      .where('agency_center')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .run(cb);
  },

  getRoutesByDistance: function(lat, lon, radius, cb){
    //gets all routes within a radius

    if (_.isFunction(radius)) {
      cb = radius;
      radius = 1; //default is 1 mile
    }

    lat = parseFloat(lat);
    lon = parseFloat(lon);

    var radiusInDegrees = Math.round(radius/69*100000)/100000
      , stop_ids = []
      , trip_ids = []
      , route_ids = []
      , routes = [];
  
    async.series([
      getStopsNearby,
      getTrips,
      getRoutes,
      lookupRoutes
    ], function(e, results){
      cb(e, routes);
    });
  
    function getStopsNearby(cb){
      Stop
        .where('loc')
        .near(lon, lat).maxDistance(radiusInDegrees)
        .run(function(e, stops){
          if(stops.length){
            stops.forEach(function(stop){
              if(stop.stop_id){
                stop_ids.push(stop.stop_id);
              }
            });
            cb(e, 'stops');
          } else {
            cb(new Error('No stops within ' + radius + ' miles'), 'stops');
          }
        });
    }
  
    function getTrips(cb){
      StopTime
        .distinct('trip_id')
        .where('stop_id').in(stop_ids)
        .run(function(e, results){
          trip_ids = results;
          cb(e, 'trips');
        });
    }
  
    function getRoutes(cb){
      Trip
        .distinct('route_id')
        .where('trip_id').in(trip_ids)
        .run(function(e, results){
          if(results.length){
            route_ids = results;
            cb(null, 'routes');
          } else {
            cb(new Error('No routes to any stops within ' + radius + ' miles'), 'routes');
          }
        });
    }
  
    function lookupRoutes(cb){
      Route
        .where('route_id').in(route_ids)
        .run(function(e, results){
          if(results.length){
            routes = results;
            cb(null, 'lookup');
          } else {
            cb(new Error('No information for routes'), 'lookup');
          }
        });
    }
  },

  getStopsByRoute: function(agency_key, route_id, direction_id, cb){
    //gets stops for one route
    
    if (_.isFunction(direction_id)) {
      cb = direction_id;
      direction_id = null;
    }

    var stopTimes = []
      , longestTrip = []
      , stops = []
      , trip_ids = []
      , stop_ids = [];
  
    async.series([
      getTrips,
      getStopTimes,
      getStops
    ], function(e, results){
      cb(e, stops);
    });

    function getTrips(cb){
      Trip
        .count({
            agency_key: agency_key
          , route_id: route_id
        })
        .run(function(e, tripCount){
          if(tripCount){
            //grab up to 30 random samples from trips to find longest one
            var count = 0;
            async.whilst(
              function(){ return count < (( tripCount > 30 ) ? 30 : tripCount) },
              function (cb) {
                count++;
                Trip
                  .findOne({ 
                      agency_key: agency_key
                      , route_id: route_id
                      , direction_id: direction_id
                  })
                  .skip(Math.floor(Math.random()*tripCount))
                  .run(function(e, trip){
                    try{
                      trip_ids.push(trip.trip_id);
                      cb();
                    } catch (e) {
                      cb();
                    }
                  });
            
              },
              function(e){
                cb(null, 'trips')
              });
          } else {
            cb(new Error('Invalid agency_key or route_id'), 'trips');
          }
        }); 
    }

    function getStopTimes(cb){
      async.forEach(
        trip_ids,
        function(trip_id, cb){
          StopTime
            .find({ agency_key: agency_key, trip_id: trip_id})
            .asc('stop_sequence')
            .run(function(e, stopTimes){
              if(stopTimes.length){
                //compare to longest trip to see if trip length is longest
                if(stopTimes.length > longestTrip.length){
                  longestTrip = stopTimes;
                }
              }
              cb();
            });
      
        }, function(e){
          cb(null, 'times');
        }
      );
    }

    function getStops(cb){
      async.forEachSeries(
        longestTrip, 
        function(stopTime, cb){
          Stop
            .findOne({ agency_key: agency_key, stop_id: stopTime.stop_id })
            .run(function(e, stop){
              stops.push(stop);
              cb();
            });
        }, function(e){
          if(e){
            cb(new Error('No stops found'), 'stops');
          } else {
            cb(null, 'stops');
          }
        });
    }
  },


  getStopsByDistance: function(lat, lon, radius, cb){
    //gets all stops within a radius

    if (_.isFunction(radius)) {
      cb = radius;
      radius = 1; //default is 1 mile
    }

    lat = parseFloat(lat);
    lon = parseFloat(lon);

    var radiusInDegrees = Math.round(radius/69*100000)/100000;

    Stop
      .where('loc')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .run(function(e, results){
        cb(e, results);
      });
  },


  getTimesByStop: function(agency_key, route_id, stop_id, direction_id, cb){
    //gets routes for one agency
    
    if (_.isFunction(direction_id)) {
      cb = direction_id;
      direction_id = null; //default is ~ 1/4 mile
    }
    
    var today = new Date()
      , service_ids = []
      , trip_ids = []
      , times = [];

    //Find service_id that matches todays date
    async.series([
      checkFields,
      findServices,
      findTrips,
      findTimes
    ], function(e, results){
      if(e){
        console.log(e);
        cb(e,null);
      } else {
        console.log(results);
        cb(e, times);
      }
    });

    function checkFields(cb){
      if(!agency_key){
        cb(new Error('No agency_key specified'), 'fields');
      } else if(!stop_id){
        cb(new Error('No stop_id specified'), 'fields');
      } else if(!route_id){
        cb(new Error('No route_id specified'), 'fields');
      } else {
        cb(null, 'fields');
      }
    }

    function findServices(cb){
      var query = { agency_key: agency_key }
        , todayFormatted = utils.formatDay(today);
   
      //build query
      query[utils.getDayName(today).toLowerCase()] = 1;
  
      Calendar
        .find(query)
        .where('start_date').lte( todayFormatted )
        .where('end_date').gte( todayFormatted )
        .run(function(e, services){
          if(services.length){
            services.forEach(function(service){
              service_ids.push(service.service_id);
            });
            cb(null, 'services');
          } else {
            cb(new Error('No Service for this date'), 'services');
          }
        });
    }

    function findTrips(cb){		
      var query = {
        agency_key: agency_key,
        route_id: route_id
      }
      
      if ((direction_id === 0) || (direction_id === 1)) {
		query.direction_id = direction_id;
	  } else {
		query["$or"] = [{direction_id:0},{direction_id:1}]
	  }		
      
      Trip
        .find(query)
        .where('service_id').in(service_ids)
        .run(function(e, trips){
          if(trips.length){
            trips.forEach(function(trip){
              trip_ids.push(trip.trip_id);
            });
            cb(null, 'trips')
          } else {
            cb(new Error('No trips for this date'), 'trips');
          }
        });
    }
    
    function findTimes(cb){
      var query = {
          agency_key: agency_key,
          stop_id: stop_id
        }
        , timeFormatted = utils.timeToSeconds(today);
      
      StopTime
        .find(query)
        .where('trip_id').in(trip_ids)
        .asc('departure_time')
        .run(function(e, stopTimes){
		  console.log("stopTimes are: " + stopTimes);
          if(stopTimes.length){
            stopTimes.forEach(function(stopTime){
              times.push(stopTime.departure_time);
            });
            cb(null, 'times');
          } else {
            cb(new Error('No times available for this stop on this date'), 'times');
          }
        });
    }
  }
}


