const mongoose = require('mongoose');

const TimetableStopOrder = mongoose.model('TimetableStopOrder', new mongoose.Schema({
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
  stop_id: String,
  stop_sequence: Number
}));

module.exports = TimetableStopOrder;
