const FareRule = require('../../models/gtfs/fare-rule');

/*
 * Returns an array of fare_rules that match the query parameters.
 */
exports.getFareRules = (query = {}, projection = '-_id -created_at', options = {lean: true, timeout: true}) => {
  return FareRule.find(query, projection, options);
};
