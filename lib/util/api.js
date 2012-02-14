var url = require('url')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db');
  
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
  , arrival_time      :  { type: String }
  , departure_time    :  { type: String }
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
  , stop_lat          :  { type: String }
  , stop_lon          :  { type: String }
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
  , direction_id      :  { type: String, index:true }
  , block_id          :  { type: String }
  , shape_id          :  { type: String }
}));


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
    , direction_id = (req.params.direction_id) ? req.params.direction_id : 0
    , stopTimes = []
    , stops = []
    , samples = 30
    , sampleCount = 0;
  
  Trip
    .count({
        agency_key: agency_key
      , route_id: route_id
      , direction_id: direction_id 
    })
    .run(function(err, tripCount){
      if(tripCount){
        //grab 30 random samples from trips to find longest one
        for(var i = 0; i < samples; i++){
          getStopTimes(Math.floor(Math.random()*tripCount));
        } 
      } else {
        res.send({ error: 'Invalid agency_key or route_id' });
      }
    })
  
  function getStopTimes(offset){
    Trip
      .find({ 
          agency_key: agency_key
          , route_id: route_id
          , direction_id: direction_id 
      })
      .skip(offset)
      .limit(1)
      .run(function(err, trip){
        StopTime
          .find({ agency_key: agency_key, trip_id: trip[0].trip_id})
          .asc('stop_sequence')
          .run(function(err, result){
            //compare to longest trip to see if trip length is longest
            if(result.length > stopTimes.length){
              stopTimes = result;
              console.log( 'Found a trip with ' + result.length + ' stops, searching for longer trip');
            }
            sampleCount++;
            if(sampleCount == samples){
              lookupStops(stopTimes);
            }
          });
      });
  }
  
  function lookupStops(stopTimes){
    var i = 0;
    stopTimes.forEach(function(stopTime){
      Stop
        .findOne({ agency_key: agency_key, stop_id: stopTime.stop_id })
        .run(function(err, stop){
          stops.push(stop);
          i++;
          if(i == stopTimes.length){
            res.send(stops);
          }
        });
    });
  }
}