var mongoose = require('mongoose');

var Stop = mongoose.model('Stop', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  stop_id: {
    type: String,
    index: true
  },
  stop_code: String,
  stop_name: String,
  stop_desc: String,
  stop_lat: Number,
  stop_lon: Number,
  loc: {
    type: Array,
    index: '2d'
  },
  zone_id: String,
  stop_url: String,
  location_type: {
    type: Number,
    min: 0,
    max: 1
  },
  parent_station: String,
  stop_timezone: String,
  wheelchair_boarding: {
    type: Number,
    min: 0,
    max: 2
  }
}));
