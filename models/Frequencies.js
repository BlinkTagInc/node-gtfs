var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var Frequencies = mongoose.model('Frequencies', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String }
  , start_time        :  { type: String }
  , end_time          :  { type: String }
  , headway_secs      :  { type: String }
  , exact_times       :  { type: String }
}, { strict: true }));
