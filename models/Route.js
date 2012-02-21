var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

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
