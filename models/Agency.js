const mongoose = require('mongoose');

const Agency = mongoose.model('Agency', new mongoose.Schema({
  agency_key: {
    type: String,
    required: true,
    index: true
  },
  agency_id: String,
  agency_name: {
    type: String,
    required: true
  },
  agency_url: {
    type: String,
    required: true
  },
  agency_timezone: {
    type: String,
    required: true
  },
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

module.exports = Agency;
