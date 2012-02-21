var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var FeedInfo = mongoose.model('FeedInfo', new Schema({
    agency_key        :  { type: String, index: true }
  , feed_publisher_name :  { type: String }
  , feed_publisher_url :  { type: String }
  , feed_lang         :  { type: String }
  , feed_start_date   :  { type: String }
  , feed_end_date     :  { type: String }
  , feed_version      :  { type: String }
}, { strict: true }));
