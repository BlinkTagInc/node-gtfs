var mongoose = require('mongoose');

var TimetableStopOrder = mongoose.model('TimetableStopOrder', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  timetable_id: {
    type: String,
    index: true
  },
  stop_id: String,
  stop_sequence: Number
}));
