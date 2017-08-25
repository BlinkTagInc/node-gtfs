const StopAttributes = require('../../models/stop-attributes');

/*
 * Returns an array of stop_attributes that match the query parameters.
 */
exports.getStopAttributes = query => StopAttributes.find(query, '-_id').lean();
