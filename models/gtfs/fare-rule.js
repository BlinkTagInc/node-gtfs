const mongoose = require('mongoose');

const FareRule = mongoose.model('FareRule', new mongoose.Schema({
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
  fare_id: {
    type: String,
    required: true
  },
  route_id: String,
  origin_id: String,
  destination_id: String,
  contains_id: String
}));

module.exports = FareRule;
