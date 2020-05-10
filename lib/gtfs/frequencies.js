const utils = require('../utils');

const Frequencies = require('../../models/gtfs/frequencies');

/*
 * Returns an array of frequencies that match the query parameters.
 */
exports.getFrequencies = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return Frequencies.find(query, projection, options);
};
