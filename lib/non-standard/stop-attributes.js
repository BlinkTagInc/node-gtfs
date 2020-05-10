const utils = require('../utils');

const StopAttributes = require('../../models/non-standard/stop-attributes');

/*
 * Returns an array of stop_attributes that match the query parameters.
 */
exports.getStopAttributes = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return StopAttributes.find(query, projection, options);
};
