const FareAttribute = require('../../models/fare-attribute');

/*
 * Returns an array of fare_attributes that match the query parameters.
 */
exports.getFareAttributes = query => FareAttribute.find(query);
