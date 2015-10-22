var mongoose = require('mongoose');

var Transfer = mongoose.model('Transfer', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  from_stop_id: String,
  to_stop_id: String,
  transfer_type: {
    type: Number,
    index: true,
    min: 0,
    max: 3
  },
  min_transfer_time: Number
}));
