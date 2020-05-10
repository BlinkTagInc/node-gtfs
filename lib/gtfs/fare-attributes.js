const utils = require('../utils');

const FareAttribute = require('../../models/gtfs/fare-attribute');

/*
 * Returns an array of fare_attributes that match the query parameters.
 */
exports.getFareAttributes = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return FareAttribute.find(query, projection, options);
};
