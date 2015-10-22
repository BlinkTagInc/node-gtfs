var mongoose = require('mongoose');
var FeedInfo = mongoose.model('FeedInfo', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  feed_publisher_name: String,
  feed_publisher_url: String,
  feed_lang: String,
  feed_start_date: Number,
  feed_end_date: Number,
  feed_version: String
}));
