const mongoose = require('mongoose');

const Timetable = mongoose.model('Timetable', new mongoose.Schema({
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
  timetable_id: {
    type: String,
    index: true
  },
  route_id: {
    type: String,
    index: true
  },
  direction_id: {
    type: Number,
    index: true,
    min: 0,
    max: 1
  },
  start_date: Number,
  end_date: Number,
  monday: {
    type: Number,
    min: 0,
    max: 1
  },
  tuesday: {
    type: Number,
    min: 0,
    max: 1
  },
  wednesday: {
    type: Number,
    min: 0,
    max: 1
  },
  thursday: {
    type: Number,
    min: 0,
    max: 1
  },
  friday: {
    type: Number,
    min: 0,
    max: 1
  },
  saturday: {
    type: Number,
    min: 0,
    max: 1
  },
  sunday: {
    type: Number,
    min: 0,
    max: 1
  },
  start_time: {
    type: String
  },
  start_timestamp: {
    type: Number
  },
  end_time: {
    type: String
  },
  end_timestamp: {
    type: Number
  },
  timetable_label: String,
  service_notes: String,
  orientation: String,
  timetable_page_id: {
    type: String,
    index: true
  },
  timetable_sequence: {
    type: Number,
    index: true
  },
  direction_name: String,
  include_exceptions: {
    type: Number,
    min: 0,
    max: 1
  },
  show_trip_continuation: {
    type: Number,
    min: 0,
    max: 1
  }
}, {}));

module.exports = Timetable;
