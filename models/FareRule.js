var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var FareRule = mongoose.model('FareRule', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , route_id          :  { type: String }
  , origin_id         :  { type: String }
  , destination_id    :  { type: String }
  , contains_id       :  { type: String }
}, { strict: true }));
