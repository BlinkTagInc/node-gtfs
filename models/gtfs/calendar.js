const mongoose = require('mongoose');

const Calendar = mongoose.model('Calendar', new mongoose.Schema({
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
  monday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  tuesday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  wednesday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  thursday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  friday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  saturday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  sunday: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  start_date: {
    type: Number,
    required: true,
    min: 10000000
  },
  end_date: {
    type: Number,
    required: true,
    min: 10000000
  }
}));

module.exports = Calendar;
