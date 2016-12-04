const mongoose = require('mongoose');

const StopAttributes = mongoose.model('StopAttributes', new mongoose.Schema({
  agency_key: {
    type: String,
    index: true
  },
  stop_id: {
    type: String,
    index: true
  },
  stop_city: String
}));

module.exports = StopAttributes;
