const FareRule = require('../../models/fare-rule');

/*
 * Returns fare_rules for the agencyKey and routeId specified
 */
exports.getFareRulesByRoute = (agencyKey, routeId) => {
  return FareRule.find({
    agency_key: agencyKey,
    route_id: routeId
  });
};
