const mongoose = require('mongoose');

const stopTimeSchema = new mongoose.Schema({
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
  trip_id: {
    type: String,
    required: true,
    index: true
  },
  arrival_time: {
    type: String
  },
  arrival_timestamp: {
    type: Number
  },
  departure_time: {
    type: String
  },
  departure_timestamp: {
    type: Number
  },
  stop_id: {
    type: String,
    required: true,
    index: true
  },
  stop_sequence: {
    type: Number,
    required: true,
    min: 0
  },
  stop_headsign: String,
  pickup_type: {
    type: Number,
    min: 0,
    max: 3
  },
  drop_off_type: {
    type: Number,
    min: 0,
    max: 3
  },
  shape_dist_traveled: Number,
  timepoint: {
    type: Number,
    min: 0,
    max: 1
  }
});

stopTimeSchema.index({
  agency_key: 1,
  stop_id: 1,
  trip_id: 1,
  stop_sequence: 1
});

module.exports = mongoose.model('StopTime', stopTimeSchema);
