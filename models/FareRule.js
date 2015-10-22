var mongoose = require('mongoose');

var FareRule = mongoose.model('FareRule', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  fare_id: String,
  route_id: String,
  origin_id: String,
  destination_id: String,
  contains_id: String
}));
