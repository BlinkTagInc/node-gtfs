const FareAttribute = require('../../models/FareAttribute');

/*
 * Returns fare_attribute for the agency_key and fare_id specified
 */
exports.getFareAttributesById = (agency_key, fare_id, cb) => {
  return FareAttribute.findOne({
    agency_key,
    fare_id
  }).exec(cb);
};
