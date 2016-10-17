const FareRule = require('../../models/FareRule');

/*
 * Returns fare_rules for the agency_key and route_id specified
 */
exports.getFareRulesByRouteId = (agency_key, route_id, cb) => {
  return FareRule.find({
    agency_key,
    route_id
  }).exec(cb);
};
