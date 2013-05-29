var mongoose = require('mongoose')
  , FareAttribute = mongoose.model('FareAttribute', new mongoose.Schema({
        agency_key        :  { type: String, index: true }
      , fare_id           :  { type: String }
      , price             :  { type: String }
      , currency_type     :  { type: String }
      , payment_method    :  { type: String }
      , transfers         :  { type: String }
      , transfer_duration :  { type: String }
    }));
