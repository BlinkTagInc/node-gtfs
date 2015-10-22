var mongoose = require('mongoose');

var Frequencies = mongoose.model('Frequencies', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  trip_id: String,
  start_time: String,
  end_time: String,
  headway_secs: Number,
  exact_times: {
    type: Number,
    min: 0,
    max: 1
  }
}));
