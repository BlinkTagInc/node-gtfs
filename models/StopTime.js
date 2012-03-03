var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , utils = require('../lib/utils');

var StopTime = mongoose.model('StopTime', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String, index: true }
  , arrival_time      :  { type: String, get: utils.secondsToTime, set: utils.timeToSeconds }
  , departure_time    :  { type: String, index: true, get: utils.secondsToTime, set: utils.timeToSeconds }
  , stop_id           :  { type: String, index: true }
  , stop_sequence     :  { type: Number, index: true }
  , stop_headsign     :  { type: String }
  , pickup_type       :  { type: String }
  , drop_off_type     :  { type: String }
  , shape_dist_traveled :  { type: String }
}, { strict: true }));
