var mongoose = require('mongoose');

var Timetable = mongoose.model('Timetable', new mongoose.Schema({
  agency_key: {
    type: String,
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
  service_id: {
    type: String,
    index: true
  },
  start_date: {
    type:  Number
  },
  end_date: {
    type:  Number
  },
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
  route_label: {
    type: String
  },
  service_notes: {
    type: String
  },
  timetable_file_name: {
    type: String
  },
  use_stop_sequence: {
    type: Number,
    min: 0,
    max: 1
  }
}));
