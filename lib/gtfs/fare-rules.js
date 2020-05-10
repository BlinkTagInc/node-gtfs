const utils = require('../utils');

const FareRule = require('../../models/gtfs/fare-rule');

/*
 * Returns an array of fare_rules that match the query parameters.
 */
exports.getFareRules = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return FareRule.find(query, projection, options);
};
