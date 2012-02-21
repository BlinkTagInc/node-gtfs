var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var Transfer = mongoose.model('Transfer', new Schema({
    agency_key        :  { type: String, index: true }
  , from_stop_id      :  { type: String }
  , to_stop_id        :  { type: String }
  , transfer_type     :  { type: String }
  , min_transfer_time :  { type: String }
}, { strict: true }));
