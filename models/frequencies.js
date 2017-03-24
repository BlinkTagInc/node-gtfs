const mongoose = require('mongoose');

const Frequencies = mongoose.model('Frequencies', new mongoose.Schema({
  agency_key: {
    type: String,
    required: true,
    index: true
  },
  trip_id: {
    type: String,
    required: true
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  },
  headway_secs: {
    type: Number,
    required: true,
    min: 0
  },
  exact_times: {
    type: Number,
    min: 0,
    max: 1
  }
}));

module.exports = Frequencies;
