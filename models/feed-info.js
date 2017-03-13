const mongoose = require('mongoose');

const FeedInfo = mongoose.model('FeedInfo', new mongoose.Schema({
  agency_key: {
    type: String,
    required: true,
    index: true
  },
  feed_publisher_name: {
    type: String,
    required: true
  },
  feed_publisher_url: {
    type: String,
    required: true
  },
  feed_lang: {
    type: String,
    required: true
  },
  feed_start_date: {
    type: Number,
    min: 10000000
  },
  feed_end_date: {
    type: Number,
    min: 10000000
  },
  feed_version: String
}));

module.exports = FeedInfo;
