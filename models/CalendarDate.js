var mongoose = require('mongoose');

var CalendarDate = mongoose.model('CalendarDate', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  service_id: String,
  date: Number,
  exception_type: {
    type: Number,
    min: 1,
    max: 2
  }
}));
