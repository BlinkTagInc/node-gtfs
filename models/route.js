const mongoose = require('mongoose');

const Route = mongoose.model('Route', new mongoose.Schema({
  agency_key: {
    type: String,
    required: true,
    index: true
  },
  route_id: {
    type: String,
    required: true,
    index: true
  },
  agency_id: String,
  route_short_name: {
    type: String,
    required: true
  },
  route_long_name: {
    type: String,
    required: true
  },
  route_desc: String,
  route_type: {
    type: Number,
    required: true,
    min: 0,
    max: 7
  },
  route_url: String,
  route_color: String,
  route_text_color: String
}));

module.exports = Route;
