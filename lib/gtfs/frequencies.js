const Frequencies = require('../../models/gtfs/frequencies');

/*
 * Returns an array of frequencies that match the query parameters.
 */
exports.getFrequencies = (query = {}, projection = '-_id', options = {lean: true}) => {
  return Frequencies.find(query, projection, options);
};
