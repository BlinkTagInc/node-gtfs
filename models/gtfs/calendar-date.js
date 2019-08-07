const mongoose = require('mongoose');

const CalendarDate = mongoose.model('CalendarDate', new mongoose.Schema({
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
  service_id: {
    type: String,
    required: true
  },
  date: {
    type: Number,
    required: true
  },
  exception_type: {
    type: Number,
    required: true,
    min: 1,
    max: 2
  },
  holiday_name: String
}));

module.exports = CalendarDate;
