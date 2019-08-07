const mongoose = require('mongoose');

const Transfer = mongoose.model('Transfer', new mongoose.Schema({
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
  from_stop_id: {
    type: String,
    required: true
  },
  to_stop_id: {
    type: String,
    required: true
  },
  transfer_type: {
    type: Number,
    required: true,
    index: true,
    min: 0,
    max: 3
  },
  min_transfer_time: {
    type: Number,
    min: 0
  }
}));

module.exports = Transfer;
