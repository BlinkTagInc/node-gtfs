var async = require('async')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db')
  , tools = require('./tools.js');
  
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
}));

var CalendarDate = mongoose.model('CalendarDate', new Schema({
    agency_key        :  { type: String, index: true }
  , service_id        :  { type: String }
  , date              :  { type: String }
  , exception_type    :  { type: String }
}));

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
}));

var FareAttribute = mongoose.model('FareAttribute', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , price             :  { type: String }
  , currency_type     :  { type: String }
  , payment_method    :  { type: String }
  , transfers         :  { type: String }
  , transfer_duration :  { type: String }
}));

var FareRule = mongoose.model('FareRule', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , route_id          :  { type: String }
  , origin_id         :  { type: String }
  , destination_id    :  { type: String }
  , contains_id       :  { type: String }
}));

var FeedInfo = mongoose.model('FeedInfo', new Schema({
    agency_key        :  { type: String, index: true }
  , feed_publisher_name :  { type: String }
  , feed_publisher_url :  { type: String }
  , feed_lang         :  { type: String }
  , feed_start_date   :  { type: String }
  , feed_end_date     :  { type: String }
  , feed_version      :  { type: String }
}));

var Frequencies = mongoose.model('Frequencies', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String }
  , start_time        :  { type: String }
  , end_time          :  { type: String }
  , headway_secs      :  { type: String }
  , exact_times       :  { type: String }
}));

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
}));

var StopTime = mongoose.model('StopTime', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String, index: true }
  , arrival_time      :  { type: String, get: secondsToTime, set: timeToSeconds }
  , departure_time    :  { type: String, index:true, get: secondsToTime, set: timeToSeconds }
  , stop_id           :  { type: String }
  , stop_sequence     :  { type: Number, index: true }
  , stop_headsign     :  { type: String }
  , pickup_type       :  { type: String }
  , drop_off_type     :  { type: String }
  , shape_dist_traveled :  { type: String }
}));

var Stop = mongoose.model('Stop', new Schema({
    agency_key        :  { type: String, index: true }
  , stop_id           :  { type: String }
  , stop_code         :  { type: String }
  , stop_name         :  { type: String }
  , stop_desc         :  { type: String }
  , loc               :  { type: Array }
  , zone_id           :  { type: String }
  , stop_url          :  { type: String }
  , location_type     :  { type: String }
  , parent_station    :  { type: String }
  , stop_timezone     :  { type: String }
}));

var Transfer = mongoose.model('Transfer', new Schema({
    agency_key        :  { type: String, index: true }
  , from_stop_id      :  { type: String }
  , to_stop_id        :  { type: String }
  , transfer_type     :  { type: String }
  , min_transfer_time :  { type: String }
}));

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
}));

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
  //gets a list of all agencies 
  
  Agency.find({}, function(err, agencies){
    if(agencies.length){
      res.send(agencies);
    } else {
      console.log(err);
      res.send({ error: 'No Agencies' });
    }
  });
}


exports.getRoutesByAgency = function(req, res){
  //gets routes for one agency
  var agency_key = req.params.agency;
  
  if(agency_key){
    Route.find({ agency_key: agency_key }, function(err, routes){
      if(routes.length){
        res.send(routes);
      } else {
        console.log(err);
        res.send({ error: 'Invalid agency_key' });
      }
    });
  } else {
    res.send({
      error: 'No agency_key specified'
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
  ], function(err, results){
    if(err){
      console.log(err);
      res.send({error: err});
    } else {
      console.log(results);
      res.send(stops);
    }
  })
  
  function getTrips(callback){
    Trip
      .count({
          agency_key: agency_key
        , route_id: route_id
        , direction_id: direction_id 
      })
      .run(function(err, tripCount){
        if(tripCount){
          //grab up to 30 random samples from trips to find longest one
          var count = 0;
          async.whilst(
            function(){ return count < (( tripCount > 30 ) ? 30 : tripCount) },
            function (callback) {
              count++;
              Trip
                .findOne({ 
                    agency_key: agency_key
                    , route_id: route_id
                    , direction_id: direction_id 
                })
                .skip(Math.floor(Math.random()*tripCount))
                .run(function(err, trip){
                  trip_ids.push(trip.trip_id);
                  callback();
                });
              
            },
            function(err){
              callback(null, 'trips')
            }) 
        } else {
          callback('Invalid agency_key or route_id', 'trips');
        }
      })    
  }

  function getStopTimes(callback){
    async.forEach(
      trip_ids,
      function(trip_id, callback){
        StopTime
          .find({ agency_key: agency_key, trip_id: trip_id})
          .asc('stop_sequence')
          .run(function(err, stopTimes){
            if(stopTimes){
              //compare to longest trip to see if trip length is longest
              if(stopTimes.length > longestTrip.length){
                console.log( 'Found a trip with ' + stopTimes.length + ' stops, searching for longer trip');
                longestTrip = stopTimes;
              }
            }
            callback();
          });
        
      }, function(err){
        callback(null, 'times');
      }
    )
  }
  
  function getStops(callback){
    async.forEachSeries(
      longestTrip, 
      function(stopTime, callback){
        Stop
          .findOne({ agency_key: agency_key, stop_id: stopTime.stop_id })
          .run(function(err, stop){
            stops.push(stop);
            callback();
          });
      }, function(err){
        if(!err){
          callback(null, 'stops');
        } else {
          callback('error', 'stops');
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
  //Do all in series
  async.series([
    checkFields,
    findServices,
    findTrips,
    findTimes
  ], function(err, results){
    if(err){
      console.log(err);
      res.send({error: err});
    } else {
      console.log(results);
      res.send(times);
    }
  });
  
  function checkFields(callback){
    if(!agency_key){
      callback('No agency_key specified', 'fields');
    } else if(!stop_id){
      callback('No stop_id specified', 'fields');
    } else if(!route_id){
      callback('No route_id specified', 'fields');
    } else {
      callback(null, 'fields');
    }
  }
  
  function findServices(callback){
    var query = { agency_key: agency_key }
      , todayFormatted = tools.formatDay(today);
     
    //build query
    query[tools.getDayName(today).toLowerCase()] = 1;
    
    Calendar
      .find(query)
      .where('start_date').lte( todayFormatted )
      .where('end_date').gte( todayFormatted )
      .run(function(err, services){
        if(services.length){
          services.forEach(function(service){
            service_ids.push(service.service_id);
          });
          callback(null, 'services');
        } else {
          callback('No Service for this date', 'services');
        }
      });
  }
  
  function findTrips(callback){
    var query = {
      agency_key: agency_key,
      route_id: route_id,
      direction_id: direction_id
    }
    Trip
      .find(query)
      .where('service_id').in(service_ids)
      .run(function(err, trips){
        if(trips){
          if(trips.length){
            trips.forEach(function(trip){
              trip_ids.push(trip.trip_id);
            });
            callback(null, 'trips')
          } else {
            callback('No trips for this date', 'trips');
          }
        }
      });
  }
  
  function findTimes(callback){
    var query = {
        agency_key: agency_key,
        stop_id: stop_id
      }
      , timeFormatted = tools.timeToSeconds(today);
    StopTime
      .find(query)
      .where('trip_id').in(trip_ids)
      .where('departure_time').gte(timeFormatted)
      .asc('departure_time')
      .run(function(err, stopTimes){
        if(stopTimes.length){
          stopTimes.forEach(function(stopTime){
            times.push(stopTime.departure_time);
          });
          callback(null, 'times');
        } else {
          callback('No times available for this stop on this date', 'times');
        }
      });
  }
  
}


