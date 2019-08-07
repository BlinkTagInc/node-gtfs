const StopAttributes = require('../../models/non-standard/stop-attributes');

/*
 * Returns an array of stop_attributes that match the query parameters.
 */
exports.getStopAttributes = (query = {}, projection = '-_id -created_at', options = {lean: true, timeout: true}) => {
  return StopAttributes.find(query, projection, options);
};
