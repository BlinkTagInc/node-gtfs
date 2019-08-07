const mongoose = require('mongoose');

const FareAttribute = mongoose.model('FareAttribute', new mongoose.Schema({
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
  price: {
    type: Number,
    required: true
  },
  currency_type: {
    type: String,
    required: true
  },
  payment_method: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  transfers: {
    type: Number,
    min: 0,
    max: 2
  },
  transfer_duration: {
    type: Number,
    min: 0
  }
}));

module.exports = FareAttribute;
