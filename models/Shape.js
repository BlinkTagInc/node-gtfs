var mongoose = require('mongoose')
  , Shape = mongoose.model('Shape', new mongoose.Schema({
        agency_key           :  { type: String, index: true }
      , shape_id             :  { type: String, index: true }
      , shape_pt_lat         :  { type: Number }
      , shape_pt_lon         :  { type: Number }
      , loc                  :  { type: Array, index: '2d' }
      , shape_pt_sequence    :  { type: Number }
      , shape_dist_traveled  :  { type: Number }
    }));
