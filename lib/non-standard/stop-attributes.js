const StopAttributes = require('../../models/non-standard/stop-attributes');

/*
 * Returns an array of stop_attributes that match the query parameters.
 */
exports.getStopAttributes = (query = {}, projection = '-_id', options = {lean: true}) => {
  return StopAttributes.find(query, projection, options);
};
