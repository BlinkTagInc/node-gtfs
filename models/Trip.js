var mongoose = require('mongoose');

var Trip = mongoose.model('Trip', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  route_id: {
    type: String,
    index: true
  },
  service_id: {
    type: String,
    index: true
  },
  trip_id: String,
  trip_headsign: String,
  trip_short_name: String,
  direction_id: {
    type: Number,
    index: true,
    min: 0,
    max: 1
  },
  block_id: String,
  shape_id: String
}));
