const FareRule = require('../../models/fare-rule');

/*
 * Returns an array of fare_rules that match the query parameters.
 */
exports.getFareRules = query => FareRule.find(query);
