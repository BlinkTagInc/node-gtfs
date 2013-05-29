var mongoose = require('mongoose')
  , Frequencies = mongoose.model('Frequencies', new mongoose.Schema({
        agency_key        :  { type: String, index: true }
      , trip_id           :  { type: String }
      , start_time        :  { type: String }
      , end_time          :  { type: String }
      , headway_secs      :  { type: String }
      , exact_times       :  { type: String }
    }));
