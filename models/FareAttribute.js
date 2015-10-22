var mongoose = require('mongoose');

var FareAttribute = mongoose.model('FareAttribute', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  fare_id: String,
  price: Number,
  currency_type: String,
  payment_method: {
    type: Number,
    min: 0,
    max: 1
  },
  transfers: {
    type: Number,
    min: 0,
    max: 2
  },
  transfer_duration: Number
}));
