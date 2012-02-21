var async = require('async')
  , mongoose = require('mongoose')
  , utils = require('./utils');

module.exports = function routes(app){
  var db = app.set('db')
    , Agency = db.model('Agency')
    , Route = db.model('Route')
    , Stop = db.model('Stop')
    , StopTime = db.model('StopTime')
    , Trip = db.model('Trip');
    
  return {
    getAllAgencies: function(req, res){
      // gets a list of all agencies
      // Endpoint
  
      Agency.find({}, function(e, agencies){
        if(agencies.length){
          res.send(agencies);
        } else {
          console.log(e);
          res.send({ error: 'No Agencies' });
        }
      });
    },


    getAgenciesByDistance: function(req, res){
      var lat = parseFloat(req.params.lat)
        , lon = parseFloat(req.params.lon)
        , radius = (req.params.radiusInMiles) ? req.params.radiusInMiles : 0.25  // default is ~ 1/4 mile
        , radiusInDegrees = Math.round(radius/69*100000)/100000;
    
      Agency
        .find()
          .where('agency_center')
          .near(lon, lat).maxDistance(radiusInDegrees)
          .run(function(e, agencies){
            console.log(agencies)
            if(agencies.length){
              res.send(agencies);
            } else {
              res.send({ error: 'No agencies within radius of ' + radius + ' miles' });
            }
        });
    },


    getRoutesByAgency: function(req, res){
      //gets routes for one agency
      var agency_key = req.params.agency;
  
      if(agency_key){
        Route.find({ agency_key: agency_key }, function(e, routes){
          if(routes.length){
            res.send(routes);
          } else {
            console.log(e);
            res.send({ error: 'Invalid agency_key' });
          }
        });
      } else {
        res.send({
          error: 'No agency_key specified'
        });
      }
    },


    getRoutesByDistance: function(req, res){
      var lat = parseFloat(req.params.lat)
        , lon = parseFloat(req.params.lon)
        , radius = (req.params.radiusInMiles) ? req.params.radiusInMiles : 0.25  // default is ~ 1/4 mile
        , radiusInDegrees = Math.round(radius/69*100000)/100000
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
        if(e){
          console.log(e);
          res.send({error: e.message});
        } else {
          console.log(results);
          res.send(routes);
        }
      });
  
      function getStopsNearby(cb){
        Stop
          .find()
            .where('loc')
            .near(lon, lat).maxDistance(radiusInDegrees)
            .run(function(e, stops){
              if(stops.length){
                stops.forEach(function(stop){
                  if(stop.stop_id){
                    stop_ids.push(stop.stop_id);
                  }
                });
                cb(null, 'stops');
              } else {
                cb(new Error('No routes within radius of ' + radius + ' miles'), 'stops');
              }
          });
      }
  
      function getTrips(cb){
        StopTime
          .distinct('trip_id')
          .where('stop_id').in(stop_ids)
          .run(function(e, results){
            if(results.length){
              trip_ids = results;
              cb(null, 'trips');
            } else {
              cb(new Error('No trips to any stops within ' + radius + ' miles'), 'trips');
            }
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
        .find()
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


    getStopsByRoute: function(req, res){
      //gets stops for one route
      var agency_key = req.params.agency
        , route_id = req.params.route_id
        , direction_id = (parseInt(req.params.direction_id, 10)) ? parseInt(req.params.direction_id, 10) : null
        , stopTimes = []
        , longestTrip = []
        , stops = []
        , trip_ids = []
        , stop_ids = [];
    
      async.series([
        getTrips,
        getStopTimes,
        getStops
      ], function(e, results){
        if(e){
          console.log(e);
          res.send({error: e.message});
        } else {
          res.send(stops);
        }
      });
  
      function getTrips(cb){
        Trip
          .count({
              agency_key: agency_key
            , route_id: route_id
            , direction_id: direction_id 
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
                      trip_ids.push(trip.trip_id);
                      cb();
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
                    console.log( 'Found a trip with ' + stopTimes.length + ' stops, searching for longer trip');
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


    getTimesByStop: function(req, res){
      //gets routes for one agency
      var agency_key = req.params.agency
        , stop_id = req.params.stop_id
        , route_id = req.params.route_id
        , direction_id = (parseInt(req.params.direction_id, 10)) ? parseInt(req.params.direction_id, 10) : null
        , today = new Date()
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
          res.send({error: e.message});
        } else {
          console.log(results);
          res.send(times);
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
          route_id: route_id,
          direction_id: direction_id
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
          .where('departure_time').gte(timeFormatted)
          .asc('departure_time')
          .run(function(e, stopTimes){
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
    },


    getStopsByDistance: function(req, res){
      var lat = parseFloat(req.params.lat)
        , lon = parseFloat(req.params.lon)
        , radius = (req.params.radiusInMiles) ? req.params.radiusInMiles : 0.25  // default is ~ 1/4 mile
        , radiusInDegrees = Math.round(radius/69*100000)/100000;
    
      Stop
        .find()
          .where('loc')
          .near(lon, lat).maxDistance(radiusInDegrees)
          .run(function(e, stops){
            if(stops.length){
              res.send(stops);
            } else {
              res.send({ error: 'No stops within radius of ' + radius + ' miles' });
            }
        });
    }
    
    
  }
}


