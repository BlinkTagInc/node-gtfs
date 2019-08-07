const mongoose = require('mongoose');

const Agency = mongoose.model('Agency', new mongoose.Schema({
  created_at: {
    type: Date,
    default: Date.now,
    required: true
  },
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
  agency_email: String,
  agency_bounds: {
    sw: {
      type: Array,
      index: '2dsphere'
    },
    ne: {
      type: Array,
      index: '2dsphere'
    }
  },
  agency_center: {
    type: [Number],
    index: '2dsphere'
  }
}));

module.exports = Agency;
