const mongoose = require('mongoose');
const utils = require('../lib/utils');

const StopTime = mongoose.model('StopTime', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  trip_id: {
    type: String,
    index: true
  },
  arrival_time: String,
  departure_time: String,
  stop_id: String,
  stop_sequence: {
    type: Number,
    index: true
  },
  stop_headsign: String,
  pickup_type: {
    type: Number,
    index: true,
    min: 0,
    max: 3
  },
  drop_off_type: {
    type: Number,
    index: true,
    min: 0,
    max: 3
  },
  shape_dist_traveled: Number,
  timepoint: {
    type: Number,
    min: 0,
    max: 1
  }
}));

module.exports = StopTime;
