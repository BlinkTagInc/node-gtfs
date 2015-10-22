var mongoose = require('mongoose');

var Shape = mongoose.model('Shape', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  shape_id: {
    type: String,
    index: true
  },
  shape_pt_lat: Number,
  shape_pt_lon: Number,
  loc: {
    type: Array,
    index: '2d'
  },
  shape_pt_sequence: Number,
  shape_dist_traveled: Number
}));
