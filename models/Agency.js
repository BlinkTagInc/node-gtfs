var mongoose = require('mongoose');

var Agency = mongoose.model('Agency', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  agency_id: String,
  agency_name: String,
  agency_url: String,
  agency_timezone: String,
  agency_lang: String,
  agency_phone: String,
  agency_fare_url: String,
  agency_bounds: {
    sw: {
      type: Array,
      index: '2d'
    },
    ne: {
      type: Array,
      index: '2d'
    }
  },
  agency_center: {
    type: Array,
    index: '2d'
  },
  date_last_updated: Number
}));
