var async = require('async')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db')
  , utils = require('./utils');
  
/**
 * Schema definitions
 */

var Agency = mongoose.model('Agency', new Schema({
    agency_key        :  { type: String, index: true }
  , agency_id         :  { type: String }
  , agency_name       :  { type: String }
  , agency_url        :  { type: String }
  , agency_timezone   :  { type: String }
  , agency_lang       :  { type: String }
  , agency_phone      :  { type: String }
  , agency_fare_url   :  { type: String }
  , agency_bounds     :  { 
      sw : {type: Array, index: '2d'}
    , ne : {type: Array, index: '2d'}
  }
  , agency_center     :  { type: Array, index: '2d' }
  
}, { strict: true }));

var CalendarDate = mongoose.model('CalendarDate', new Schema({
    agency_key        :  { type: String, index: true }
  , service_id        :  { type: String }
  , date              :  { type: String }
  , exception_type    :  { type: String }
}, { strict: true }));

var Calendar = mongoose.model('Calendar', new Schema({
    agency_key        :  { type: String, index: true }
  , service_id        :  { type: String }
  , monday            :  { type: String }
  , tuesday           :  { type: String }
  , wednesday         :  { type: String }
  , thursday          :  { type: String }
  , friday            :  { type: String }
  , saturday          :  { type: String }
  , sunday            :  { type: String }
  , start_date        :  { type: String }
  , end_date          :  { type: String }
}, { strict: true }));

var FareAttribute = mongoose.model('FareAttribute', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , price             :  { type: String }
  , currency_type     :  { type: String }
  , payment_method    :  { type: String }
  , transfers         :  { type: String }
  , transfer_duration :  { type: String }
}, { strict: true }));

var FareRule = mongoose.model('FareRule', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , route_id          :  { type: String }
  , origin_id         :  { type: String }
  , destination_id    :  { type: String }
  , contains_id       :  { type: String }
}, { strict: true }));

var FeedInfo = mongoose.model('FeedInfo', new Schema({
    agency_key        :  { type: String, index: true }
  , feed_publisher_name :  { type: String }
  , feed_publisher_url :  { type: String }
  , feed_lang         :  { type: String }
  , feed_start_date   :  { type: String }
  , feed_end_date     :  { type: String }
  , feed_version      :  { type: String }
}, { strict: true }));

var Frequencies = mongoose.model('Frequencies', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String }
  , start_time        :  { type: String }
  , end_time          :  { type: String }
  , headway_secs      :  { type: String }
  , exact_times       :  { type: String }
}, { strict: true }));

var Route = mongoose.model('Route', new Schema({
    agency_key        :  { type: String, index: true }
  , route_id          :  { type: String }
  , agency_id         :  { type: String }
  , route_short_name  :  { type: String }
  , route_long_name   :  { type: String }
  , route_desc        :  { type: String }
  , route_type        :  { type: String }
  , route_url         :  { type: String }
  , route_color       :  { type: String }
  , route_text_color  :  { type: String }
}, { strict: true }));

var StopTime = mongoose.model('StopTime', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String, index: true }
  , arrival_time      :  { type: String, get: secondsToTime, set: timeToSeconds }
  , departure_time    :  { type: String, index:true, get: secondsToTime, set: timeToSeconds }
  , stop_id           :  { type: String, index:true }
  , stop_sequence     :  { type: Number, index: true }
  , stop_headsign     :  { type: String }
  , pickup_type       :  { type: String }
  , drop_off_type     :  { type: String }
  , shape_dist_traveled :  { type: String }
}, { strict: true }));

var Stop = mongoose.model('Stop', new Schema({
    agency_key        :  { type: String, index: true }
  , stop_id           :  { type: String }
  , stop_code         :  { type: String }
  , stop_name         :  { type: String }
  , stop_desc         :  { type: String }
  , loc               :  { type: Array, index: '2d' }
  , zone_id           :  { type: String }
  , stop_url          :  { type: String }
  , location_type     :  { type: String }
  , parent_station    :  { type: String }
  , stop_timezone     :  { type: String }
}, { strict: true }));

var Transfer = mongoose.model('Transfer', new Schema({
    agency_key        :  { type: String, index: true }
  , from_stop_id      :  { type: String }
  , to_stop_id        :  { type: String }
  , transfer_type     :  { type: String }
  , min_transfer_time :  { type: String }
}, { strict: true }));

var Trip = mongoose.model('Trip', new Schema({
    agency_key        :  { type: String, index: true }
  , route_id          :  { type: String, index: true }
  , service_id        :  { type: String, index:true }
  , trip_id           :  { type: String }
  , trip_headsign     :  { type: String }
  , trip_short_name   :  { type: String }
  , direction_id      :  { type: Number, index:true, min:0, max:1 }
  , block_id          :  { type: String }
  , shape_id          :  { type: String }
}, { strict: true }));

function timeToSeconds(time){
  if(time instanceof Date){
    var timeParts = [ time.getHours(), time.getMinutes(), time.getSeconds() ];
  } else {
    var timeParts = time.split(':');
    if(timeParts.length != 3){
      return null;
    }
  }
  return parseInt(timeParts[0], 10) * 60 * 60 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
}

function secondsToTime(seconds){
  var hour = Math.floor(seconds / (60 * 60))
    , minute = Math.floor((seconds - hour * (60 * 60)) / 60)
    , second = seconds - hour * (60 * 60) - minute * 60;
  return ((hour < 10) ? '' + '0' + hour : hour) + ':' + ((minute<10) ? '' + '0' + minute : minute) + ':' + ((second<10) ? '' + '0' + second : second);
}



exports.getAllAgencies = function(req, res){
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
}


exports.getAgenciesByDistance = function(req, res){
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
}



exports.getRoutesByAgency = function(req, res){
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
}


exports.getRoutesByDistance = function(req, res){
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
  
}



exports.getStopsByRoute = function(req, res){
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
  })
  
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
            }) 
        } else {
          cb(new Error('Invalid agency_key or route_id'), 'trips');
        }
      })    
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
    )
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
}


exports.getTimesByStop = function(req, res){
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
  
}


exports.getStopsByDistance = function(req, res){
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


